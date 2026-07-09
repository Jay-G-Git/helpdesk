import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../../../lib/apiAuth'
import PDFDocument from 'pdfkit'

function fmt(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// GET /api/payroll/run/[id]/paystub?employeeId=xxx  — returns PDF for one employee
// GET /api/payroll/run/[id]/paystub                 — returns PDF for all employees
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const employeeId = req.nextUrl.searchParams.get('employeeId')

  // Load run
  const { data: run } = await supabaseAdmin
    .from('payroll_runs')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Load business name
  const { data: biz } = await supabaseAdmin
    .from('business_profiles')
    .select('business_name')
    .eq('user_id', user.id)
    .single()

  // Load items
  let itemsQuery = supabaseAdmin
    .from('payroll_run_items')
    .select('*')
    .eq('run_id', run.id)
    .order('employee_name')

  if (employeeId) {
    itemsQuery = itemsQuery.eq('employee_id', parseInt(employeeId))
  }

  const { data: items } = await itemsQuery
  if (!items?.length) return NextResponse.json({ error: 'No items found' }, { status: 404 })

  const businessName = biz?.business_name ?? 'Your Company'
  const periodStart = new Date(run.period_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const periodEnd = new Date(run.period_end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  // Build PDF
  const doc = new PDFDocument({ size: 'LETTER', margin: 50, bufferPages: true })
  const chunks: Buffer[] = []
  doc.on('data', chunk => chunks.push(chunk))

  const primaryBlue = '#185fa5'
  const lightGray = '#f7f9fc'
  const borderGray = '#e5e7eb'
  const textDark = '#1a1a1a'
  const textMuted = '#6b7280'

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (i > 0) doc.addPage()

    const pageW = doc.page.width
    const margin = 50
    let y = margin

    // ── Header bar ─────────────────────────────────────────────────────────
    doc.rect(margin, y, pageW - margin * 2, 64).fill(primaryBlue)

    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(18)
      .text(businessName, margin + 18, y + 12, { width: pageW - margin * 2 - 36 })
    doc.fillColor('rgba(255,255,255,0.75)').font('Helvetica').fontSize(10)
      .text('PAY STUB', margin + 18, y + 36)

    y += 80

    // ── Pay period row ──────────────────────────────────────────────────────
    doc.rect(margin, y, pageW - margin * 2, 36).fill(lightGray)
    doc.fillColor(textMuted).font('Helvetica').fontSize(9)
      .text('PAY PERIOD', margin + 12, y + 6)
    doc.fillColor(textDark).font('Helvetica-Bold').fontSize(11)
      .text(`${periodStart} – ${periodEnd}`, margin + 12, y + 18)

    const runDateStr = new Date(run.run_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    doc.fillColor(textMuted).font('Helvetica').fontSize(9)
      .text('RUN DATE', pageW / 2, y + 6)
    doc.fillColor(textDark).font('Helvetica-Bold').fontSize(11)
      .text(runDateStr, pageW / 2, y + 18)

    y += 50

    // ── Employee info ───────────────────────────────────────────────────────
    doc.fillColor(textMuted).font('Helvetica').fontSize(9).text('EMPLOYEE', margin, y)
    y += 14
    doc.fillColor(textDark).font('Helvetica-Bold').fontSize(14)
      .text(item.employee_name, margin, y)
    y += 20
    doc.fillColor(textMuted).font('Helvetica').fontSize(10)
      .text(item.pay_type === 'salary' ? `Salaried — ${fmt(item.pay_rate)}/yr` : `Hourly — ${fmt(item.pay_rate)}/hr`, margin, y)
    y += 30

    // ── Earnings table ──────────────────────────────────────────────────────
    doc.fillColor(textMuted).font('Helvetica-Bold').fontSize(9)
      .text('EARNINGS', margin, y)
    y += 14

    // Table header
    doc.rect(margin, y, pageW - margin * 2, 26).fill('#e8f0fe')
    doc.fillColor(primaryBlue).font('Helvetica-Bold').fontSize(9)
    doc.text('Description', margin + 10, y + 8)
    doc.text('Hours', pageW - margin - 200, y + 8)
    doc.text('Rate', pageW - margin - 130, y + 8)
    doc.text('Amount', pageW - margin - 60, y + 8)
    y += 26

    // Earnings row
    doc.rect(margin, y, pageW - margin * 2, 28).fill('#fff').stroke(borderGray)
    doc.fillColor(textDark).font('Helvetica').fontSize(10)
    doc.text(item.pay_type === 'salary' ? 'Bi-weekly salary' : 'Regular hours', margin + 10, y + 9)
    if (item.hours_worked != null) {
      doc.text(`${item.hours_worked}`, pageW - margin - 200, y + 9)
      doc.text(fmt(item.pay_rate), pageW - margin - 130, y + 9)
    } else {
      doc.text('—', pageW - margin - 200, y + 9)
      doc.text('—', pageW - margin - 130, y + 9)
    }
    doc.font('Helvetica-Bold').text(fmt(item.gross_pay), pageW - margin - 60, y + 9)
    y += 36

    // ── Deductions table ────────────────────────────────────────────────────
    const deductions = (item.deductions ?? {}) as Record<string, number>
    const deductionRows = [
      { label: 'Federal income tax', key: 'federal' },
      { label: 'State income tax', key: 'state' },
      { label: 'Other deductions', key: 'other' },
    ]

    doc.fillColor(textMuted).font('Helvetica-Bold').fontSize(9)
      .text('DEDUCTIONS', margin, y)
    y += 14

    doc.rect(margin, y, pageW - margin * 2, 26).fill('#fef2f2')
    doc.fillColor('#991b1b').font('Helvetica-Bold').fontSize(9)
    doc.text('Description', margin + 10, y + 8)
    doc.text('Amount', pageW - margin - 60, y + 8)
    y += 26

    for (const row of deductionRows) {
      const amount = deductions[row.key] ?? 0
      doc.rect(margin, y, pageW - margin * 2, 26).fill('#fff').stroke(borderGray)
      doc.fillColor(textDark).font('Helvetica').fontSize(10)
        .text(row.label, margin + 10, y + 8)
      doc.text(fmt(amount), pageW - margin - 60, y + 8)
      y += 26
    }

    y += 14

    // ── Summary box ─────────────────────────────────────────────────────────
    const summaryX = pageW / 2
    const summaryW = pageW / 2 - margin

    doc.rect(summaryX, y, summaryW, 80).fill(lightGray).stroke(borderGray)

    doc.fillColor(textMuted).font('Helvetica').fontSize(9)
      .text('GROSS PAY', summaryX + 14, y + 10)
    doc.fillColor(textDark).font('Helvetica-Bold').fontSize(13)
      .text(fmt(item.gross_pay), summaryX + 14, y + 22)

    doc.moveTo(summaryX + 14, y + 44).lineTo(summaryX + summaryW - 14, y + 44).stroke(borderGray)

    doc.fillColor(textMuted).font('Helvetica').fontSize(9)
      .text('NET PAY', summaryX + 14, y + 52)
    doc.fillColor(primaryBlue).font('Helvetica-Bold').fontSize(16)
      .text(fmt(item.net_pay), summaryX + 14, y + 62)

    y += 94

    // ── Footer ──────────────────────────────────────────────────────────────
    doc.fillColor(textMuted).font('Helvetica').fontSize(8)
      .text(
        `This pay stub was generated by helpdesk on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`,
        margin, doc.page.height - 40, { align: 'center', width: pageW - margin * 2 }
      )
  }

  doc.end()

  await new Promise<void>(resolve => doc.on('end', resolve))
  const pdfBuffer = Buffer.concat(chunks)

  const filename = items.length === 1
    ? `paystub-${items[0].employee_name.replace(/\s+/g, '-')}-${run.period_end}.pdf`
    : `paystubs-${run.period_end}.pdf`

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
