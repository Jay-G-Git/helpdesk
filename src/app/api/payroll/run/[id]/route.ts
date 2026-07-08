import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

async function getOwner(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user ?? null
}

// GET — fetch run + items
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getOwner(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: run } = await supabaseAdmin
    .from('payroll_runs')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: items } = await supabaseAdmin
    .from('payroll_run_items')
    .select('*')
    .eq('run_id', run.id)
    .order('employee_name')

  return NextResponse.json({ run, items: items ?? [] })
}

// PATCH — update item deductions or finalize run
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getOwner(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Finalize the run
  if (body.action === 'finalize') {
    await supabaseAdmin
      .from('payroll_runs')
      .update({ status: 'finalized' })
      .eq('id', params.id)
      .eq('user_id', user.id)
    return NextResponse.json({ ok: true })
  }

  // Update deductions for a specific item
  if (body.itemId && body.deductions !== undefined) {
    const { data: item } = await supabaseAdmin
      .from('payroll_run_items')
      .select('gross_pay')
      .eq('id', body.itemId)
      .single()

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const totalDeductions = Object.values(body.deductions as Record<string, number>).reduce((s, v) => s + (v ?? 0), 0)
    const netPay = Math.round((item.gross_pay - totalDeductions) * 100) / 100

    await supabaseAdmin
      .from('payroll_run_items')
      .update({ deductions: body.deductions, net_pay: netPay })
      .eq('id', body.itemId)

    return NextResponse.json({ ok: true, netPay })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// DELETE — delete a draft run
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getOwner(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin
    .from('payroll_runs')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)
    .eq('status', 'draft')

  return NextResponse.json({ ok: true })
}
