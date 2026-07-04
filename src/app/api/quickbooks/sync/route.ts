import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { refreshAccessToken, createPayrollExpense } from '../../../../lib/quickbooks'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const userToken = authHeader?.replace('Bearer ', '')
  if (!userToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(userToken)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { periodStart, periodEnd } = await req.json()

  // Load QuickBooks connection
  const { data: conn } = await supabase
    .from('quickbooks_connections')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!conn) return NextResponse.json({ error: 'QuickBooks not connected.' }, { status: 400 })

  // Refresh token if expired
  let accessToken = conn.access_token
  if (new Date(conn.access_token_expires_at) <= new Date()) {
    const refreshed = await refreshAccessToken(conn.refresh_token)
    accessToken = refreshed.access_token
    const expiresAt = new Date(Date.now() + (refreshed.expires_in - 60) * 1000).toISOString()
    await supabase
      .from('quickbooks_connections')
      .update({ access_token: accessToken, access_token_expires_at: expiresAt })
      .eq('user_id', user.id)
  }

  // Determine date range (default: current month)
  const now = new Date()
  const start = periodStart ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const end = periodEnd ?? now.toISOString().slice(0, 10)

  // Fetch payroll entries
  const { data: entries, error: entErr } = await supabase
    .from('payroll_entries')
    .select('id, employee_id, gross_pay, period_start, period_end, created_at')
    .eq('user_id', user.id)
    .gte('period_start', start)
    .lte('period_end', end)

  if (entErr) return NextResponse.json({ error: 'Could not load payroll entries.' }, { status: 500 })
  if (!entries || entries.length === 0) {
    return NextResponse.json({ pushed: 0, message: 'No payroll entries found in that range.' })
  }

  // Fetch employee names
  const empIds = [...new Set(entries.map(e => e.employee_id))]
  const { data: employees } = await supabase
    .from('employees')
    .select('id, name')
    .in('id', empIds)

  const empMap = new Map((employees ?? []).map(e => [e.id, e.name as string]))

  let pushed = 0
  const errors: string[] = []

  for (const entry of entries) {
    const empName = empMap.get(entry.employee_id) ?? 'Employee'
    const txnDate = entry.period_end ?? entry.created_at?.slice(0, 10) ?? end
    const memo = `Payroll: ${empName} (${entry.period_start} – ${entry.period_end})`

    try {
      await createPayrollExpense(
        conn.realm_id,
        accessToken,
        empName,
        entry.gross_pay,
        txnDate,
        memo,
      )
      pushed++
    } catch (err) {
      errors.push(`${empName}: ${err}`)
    }
  }

  return NextResponse.json({ pushed, errors: errors.length ? errors : undefined })
}
