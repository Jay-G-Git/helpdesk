jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { GET } from '../../app/api/analytics/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

function mockOwner(user: { id: string } | null) {
  ;(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({ data: { user } })
}

describe('GET /api/analytics', () => {
  it('returns 401 without a token', async () => {
    const res = await GET(mockRequest() as never)
    expect(res.status).toBe(401)
  })

  it('summarizes payroll, hours, and headcount', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: [{ gross_pay: 500, created_at: new Date().toISOString() }, { gross_pay: 300, created_at: new Date().toISOString() }], error: null },
      { data: [{ employee_id: 1, total_minutes: 120, clock_in: new Date().toISOString(), employees: { name: 'Jane' } }], error: null },
      { data: [{ id: 1, name: 'Jane', created_at: new Date().toISOString() }], error: null },
    ])
    const res = await GET(mockRequest({ token: 'good' }) as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.summary.totalPayroll).toBe(800)
    expect(body.summary.totalHours).toBe(2)
    expect(body.summary.activeEmployees).toBe(1)
    expect(body.hoursData[0]).toEqual({ name: 'Jane', hours: 2 })
  })

  it('handles empty data without throwing', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ])
    const res = await GET(mockRequest({ token: 'good' }) as never)
    const body = await res.json()
    expect(body.summary).toEqual({ totalPayroll: 0, totalHours: 0, activeEmployees: 0 })
  })
})
