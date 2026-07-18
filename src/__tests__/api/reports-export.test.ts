jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { GET } from '../../app/api/reports/export/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

function mockOwner(user: { id: string } | null) {
  ;(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({ data: { user } })
}

describe('GET /api/reports/export', () => {
  it('returns 401 without a token', async () => {
    const res = await GET(mockRequest() as never)
    expect(res.status).toBe(401)
  })

  it('returns real CSV, not JSON, scoped to active employees', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: [{ id: 1, name: 'Jordan T.', role: 'Cashier', status: 'active' }, { id: 2, name: 'Old Hire', role: 'Cook', status: 'terminated' }], error: null },
      { data: [{ employee_id: 1, total_minutes: 600, clock_in: '2026-07-01T09:00:00Z' }], error: null },
      { data: [{ employee_id: 1, start_date: '2026-07-01', end_date: '2026-07-02', status: 'approved' }], error: null },
      { data: [{ employee_id: 1, gross_pay: 850.5, period_start: '2026-06-16', period_end: '2026-06-30' }], error: null },
      { data: [], error: null }, // payroll_run_items — none this test
    ])
    const res = await GET(mockRequest({ token: 'good' }) as never)
    expect(res.headers.get('Content-Type')).toBe('text/csv')
    expect(res.headers.get('Content-Disposition')).toContain('.csv')
    const text = await res.text()
    expect(text.startsWith('{')).toBe(false) // not JSON
    const lines = text.split('\n')
    expect(lines[0]).toBe('"Employee","Role","Hours (last 12mo)","PTO Days Used (last 12mo)","Most Recent Payroll Period","Gross Pay (last 12mo)"')
    // Only the active employee should appear
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('"Jordan T."')
    expect(lines[1]).toContain('"10"') // 600 min = 10 hours
    expect(lines[1]).toContain('"2"') // 2-day PTO span
    expect(lines[1]).toContain('"850.50"')
  })

  // JAY-88 — "Run Payroll" writes to payroll_run_items, not payroll_entries;
  // this export previously undercounted (or entirely omitted) gross pay for
  // anyone paid via that path, which is the primary payroll flow.
  it('merges payroll_run_items gross pay alongside payroll_entries', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: [{ id: 1, name: 'Jordan T.', role: 'Cashier', status: 'active' }], error: null },
      { data: [], error: null }, // time_entries
      { data: [], error: null }, // time_off_requests
      { data: [{ employee_id: 1, gross_pay: 200, period_start: '2026-06-01', period_end: '2026-06-15' }], error: null }, // payroll_entries
      { data: [{ employee_id: 1, gross_pay: 850.5, run_id: 42, created_at: '2026-07-01T00:00:00Z' }], error: null }, // payroll_run_items
      { data: [{ id: 42, period_start: '2026-06-16', period_end: '2026-06-30' }], error: null }, // payroll_runs lookup
    ])
    const res = await GET(mockRequest({ token: 'good' }) as never)
    const text = await res.text()
    const lines = text.split('\n')
    // 200 (payroll_entries) + 850.50 (payroll_run_items) = 1050.50
    expect(lines[1]).toContain('"1050.50"')
    // Most recent period should come from the later payroll_run_items entry
    expect(lines[1]).toContain('"2026-06-16 – 2026-06-30"')
  })
})
