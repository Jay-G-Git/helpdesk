import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getBearerUser } from '../../../lib/apiAuth'

// GET /api/payroll/run — list all runs
export async function GET(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: runs } = await supabaseAdmin
    .from('payroll_runs')
    .select('*')
    .eq('user_id', user.id)
    .order('period_start', { ascending: false })
    .limit(24)

  return NextResponse.json({ runs: runs ?? [] })
}

// POST /api/payroll/run — create a new run (auto-calculate from time entries)
export async function POST(req: NextRequest) {
  const user = await getBearerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { periodStart, periodEnd, notes } = await req.json()
  if (!periodStart || !periodEnd) {
    return NextResponse.json({ error: 'periodStart and periodEnd required' }, { status: 400 })
  }

  // Fetch active employees with pay info
  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('id, name, pay_type, pay_rate')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .not('pay_rate', 'is', null)

  if (!employees?.length) {
    return NextResponse.json({ error: 'No active employees with pay rates set.' }, { status: 400 })
  }

  // Fetch time entries for the period (for hourly employees)
  const { data: timeEntries } = await supabaseAdmin
    .from('time_entries')
    .select('employee_id, total_minutes')
    .eq('user_id', user.id)
    .gte('clock_in', `${periodStart}T00:00:00`)
    .lte('clock_in', `${periodEnd}T23:59:59`)
    .not('clock_out', 'is', null)

  // Build hours map
  const hoursMap: Record<number, number> = {}
  for (const entry of timeEntries ?? []) {
    if (!hoursMap[entry.employee_id]) hoursMap[entry.employee_id] = 0
    hoursMap[entry.employee_id] += (entry.total_minutes ?? 0) / 60
  }

  // Calculate pay items
  const items = employees.map(emp => {
    const rate = emp.pay_rate ?? 0
    let hoursWorked: number | null = null
    let grossPay: number

    if (emp.pay_type === 'salary') {
      // Bi-weekly pay = annual / 26
      grossPay = rate / 26
    } else {
      hoursWorked = Math.round((hoursMap[emp.id] ?? 0) * 100) / 100
      grossPay = hoursWorked * rate
    }

    return {
      user_id: user.id,
      employee_id: emp.id,
      employee_name: emp.name,
      pay_type: emp.pay_type,
      pay_rate: rate,
      hours_worked: hoursWorked,
      gross_pay: Math.round(grossPay * 100) / 100,
      deductions: { federal: 0, state: 0, other: 0 },
      net_pay: Math.round(grossPay * 100) / 100,
    }
  })

  const totalGross = items.reduce((s, i) => s + i.gross_pay, 0)

  // Create the run record
  const { data: run, error: runErr } = await supabaseAdmin
    .from('payroll_runs')
    .insert({
      user_id: user.id,
      period_start: periodStart,
      period_end: periodEnd,
      total_gross: Math.round(totalGross * 100) / 100,
      employee_count: items.length,
      notes: notes ?? null,
    })
    .select()
    .single()

  if (runErr || !run) return NextResponse.json({ error: runErr?.message ?? 'Failed to create run' }, { status: 500 })

  // Insert line items
  const itemsWithRunId = items.map(i => ({ ...i, run_id: run.id }))
  await supabaseAdmin.from('payroll_run_items').insert(itemsWithRunId)

  return NextResponse.json({ run })
}
