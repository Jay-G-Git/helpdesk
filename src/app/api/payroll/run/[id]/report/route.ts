import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../../../lib/apiAuth'
import PDFDocument from 'pdfkit'

function fmt(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// GET /api/payroll/run/[id]/report — accountant-ready PDF summary for the whole run
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: run } = await supabaseAdmin
    .from('payroll_runs')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: biz } = await supabaseAdmin
    .from('business_profiles')
    .select('business_name')
    .eq('user_id', user.id)
    .single()

  const { data: items } = await supabaseAdmin
    .from('payroll_run_items')
    .select('*')
    .eq('run_id', run.id)
    .order('employee_name')

  if (!items?.length) return NextResponse.json({ error: 'No items found' }, { status: 404 })

  const businessName = biz?.business_name ?? 'Your Company'
  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const periodStart = fmtDate(run.period_start)
  const periodEnd = fmtDate(run.period_end)
  const runDate = fmtDate(run.run_date)

  const primaryBlue = '#185fa5'
  const lightBlue = '#e8f0fe'
  const lightGray = '#f7f9fc'
  const borderGray = '#e5e7eb'
  const textDark = '#1a1a1a'
  const textMuted = '#6b7280'

  const doc = new PDFDocument({ size: 'LETTER', margin: 50, bufferPages: true })
  const chunks: Buffer[] = []
  doc.on('data', chunk => chunks.push(chunk))

  const pageW = doc.page.width
  const margin = 50
  const contentW = pageW - margin * 2

  let y = margin

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.rect(margin, y, contentW, 70).fill(primaryBlue)
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(20)
    .text(businessName, margin + 20, y + 12, { width: contentW - 40 })
  doc.fillColor('rgba(255,255,255,0.8)').font('Helvetica').fontSize(10)
    .text('PAYROLL SUMMARY REPORT', margin + 20, y + 38)
  doc.fillColor('rgba(255,255,255,0.65)').fontSize(9)
    .text(`Prepared ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin + 20, y + 52)
  y += 84

  // ── Meta row ────────────────────────────────────────────────────────────────
  const metaCols = [
    { label: 'PAY PERIOD', value: `${periodStart} – ${periodEnd}` },
    { label: 'RUN DATE', value: runDate },
    { label: 'STATUS', value: run.status === 'finalized' ? 'Finalized' : 'Draft' },
    { label: 'EMPLOYEES', value: String(items.length) },
  ]
  const colW = contentW / metaCols.length
  doc.rect(margin, y, contentW, 48).fill(lightGray)
  metaCols.forEach((col, i) => {
    const x = margin + i * colW + 12
    doc.fillColor(textMuted).font('Helvetica').fontSize(8).text(col.label, x, y + 8)
    doc.fillColor(textDark).font('Helvetica-Bold').fontSize(11).text(col.value, x, y + 20)
  })
  y += 62

  // ── Table ────────────────────────────────────────────────────────────────────
  const cols = [
    { label: 'Employee', x: margin, w: 130, align: 'left' as const },
    { label: 'Type', x: margin + 130, w: 50, align: 'left' as const },
    { label: 'Hours', x: margin + 180, w: 45, align: 'right' as const },
    { label: 'Rate', x: margin + 225, w: 60, align: 'right' as const },
    { label: 'Gross Pay', x: margin + 285, w: 70, align: 'right' as const },
    { label: 'Federal', x: margin + 355, w: 55, align: 'right' as const },
    { label: 'State', x: margin + 410, w: 50, align: 'right' as const },
    { label: 'Other', x: margin + 460, w: 45, align: 'right' as const },
    { label: 'Net Pay', x: margin + 505, w: 65, align: 'right' as const },
  ]

  // Table header
  doc.rect(margin, y, contentW, 26).fill(primaryBlue)
  cols.forEach(col => {
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8)
      .text(col.label, col.x + (col.align === 'right' ? 0 : 6), y + 9, { width: col.w, align: col.align })
  })
  y += 26

  // Rows
  let totalGross = 0, totalFederal = 0, totalState = 0, totalOther = 0, totalNet = 0, totalHours = 0

  items.forEach((item, i) => {
    const rowH = 26
    doc.rect(margin, y, contentW, rowH).fill(i % 2 === 0 ? '#fff' : lightGray)
    doc.rect(margin, y, contentW, rowH).stroke(borderGray)

    const d = (item.deductions ?? {}) as Record<string, number>
    const federal = d.federal ?? 0
    const state = d.state ?? 0
    const other = d.other ?? 0

    totalGross += item.gross_pay
    totalFederal += federal
    totalState += state
    totalOther += other
    totalNet += item.net_pay
    if (item.hours_worked) totalHours += item.hours_worked

    const rowData = [
      { col: cols[0], val: item.employee_name },
      { col: cols[1], val: item.pay_type === 'salary' ? 'Salary' : 'Hourly' },
      { col: cols[2], val: item.hours_worked != null ? String(Math.round(item.hours_worked * 100) / 100) : '—' },
      { col: cols[3], val: item.pay_type === 'salary' ? fmt(item.pay_rate) + '/yr' : fmt(item.pay_rate) + '/hr' },
      { col: cols[4], val: fmt(item.gross_pay) },
      { col: cols[5], val: fmt(federal) },
      { col: cols[6], val: fmt(state) },
      { col: cols[7], val: fmt(other) },
      { col: cols[8], val: fmt(item.net_pay) },
    ]

    rowData.forEach(({ col, val }) => {
      const isMoney = col.label === 'Gross Pay' || col.label === 'Net Pay'
      doc.fillColor(isMoney ? primaryBlue : textDark)
        .font(isMoney ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9)
        .text(val, col.x + (col.align === 'right' ? 0 : 6), y + 8, { width: col.w, align: col.align })
    })

    y += rowH
  })

  // Totals row
  doc.rect(margin, y, contentW, 30).fill(lightBlue)
  doc.fillColor(primaryBlue).font('Helvetica-Bold').fontSize(9)
    .text('TOTALS', cols[0].x + 6, y + 10, { width: cols[0].w })
  doc.fillColor(textMuted).font('Helvetica').fontSize(9)
    .text(totalHours > 0 ? String(Math.round(totalHours * 100) / 100) : '', cols[2].x, y + 10, { width: cols[2].w, align: 'right' })

  const totals = [
    { col: cols[4], val: fmt(totalGross) },
    { col: cols[5], val: fmt(totalFederal) },
    { col: cols[6], val: fmt(totalState) },
    { col: cols[7], val: fmt(totalOther) },
    { col: cols[8], val: fmt(totalNet) },
  ]
  totals.forEach(({ col, val }) => {
    doc.fillColor(primaryBlue).font('Helvetica-Bold').fontSize(9)
      .text(val, col.x, y + 10, { width: col.w, align: 'right' })
  })
  y += 44

  // ── Summary box ──────────────────────────────────────────────────────────────
  const totalDeductions = totalFederal + totalState + totalOther
  const summaryItems = [
    { label: 'Total gross pay', value: fmt(totalGross), highlight: false },
    { label: 'Total deductions', value: fmt(totalDeductions), highlight: false },
    { label: 'Total net pay', value: fmt(totalNet), highlight: true },
  ]

  const boxW = 220
  const boxX = pageW - margin - boxW
  doc.rect(boxX, y, boxW, 26 + summaryItems.length * 28).fill(lightGray).stroke(borderGray)

  doc.fillColor(textMuted).font('Helvetica-Bold').fontSize(8)
    .text('SUMMARY', boxX + 14, y + 10)

  summaryItems.forEach((s, i) => {
    const sy = y + 30 + i * 28
    doc.fillColor(s.highlight ? primaryBlue : textDark)
      .font(s.highlight ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(s.highlight ? 12 : 10)
      .text(s.label, boxX + 14, sy)
    doc.fillColor(s.highlight ? primaryBlue : textDark)
      .font('Helvetica-Bold')
      .fontSize(s.highlight ? 14 : 10)
      .text(s.value, boxX + 14, sy, { width: boxW - 28, align: 'right' })
    if (i < summaryItems.length - 1) {
      doc.moveTo(boxX + 14, sy + 20).lineTo(boxX + boxW - 14, sy + 20).stroke(borderGray)
    }
  })

  // ── Footer ───────────────────────────────────────────────────────────────────
  doc.fillColor(textMuted).font('Helvetica').fontSize(8)
    .text(
      `This report was generated by helpdesk for ${businessName}. Please review all figures with your accountant before filing.`,
      margin, doc.page.height - 40, { align: 'center', width: contentW }
    )

  doc.end()
  await new Promise<void>(resolve => doc.on('end', resolve))
  const pdfBuffer = Buffer.concat(chunks)

  const filename = `payroll-report-${run.period_end}.pdf`

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
