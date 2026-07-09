jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: {}, from: jest.fn() } }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { POST } from '../../app/api/employee/clock-out/route'
import { mockAuthUser, queueFromResponses, mockRequest } from '../helpers/supabaseMock'

describe('POST /api/employee/clock-out', () => {
  it('returns 404 when no employee record matches the email', async () => {
    mockAuthUser(supabaseAdmin, { email: 'ghost@example.com' })
    queueFromResponses(supabaseAdmin, [{ data: null, error: null }])
    const res = await POST(mockRequest({ token: 'good' }) as never)
    expect(res.status).toBe(404)
  })

  it('returns 400 when there is no open time entry', async () => {
    mockAuthUser(supabaseAdmin, { email: 'jane@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { id: 1 }, error: null },
      { data: null, error: null }, // no open entry
    ])
    const res = await POST(mockRequest({ token: 'good' }) as never)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/not clocked in/i)
  })

  it('closes the open entry and computes total minutes', async () => {
    mockAuthUser(supabaseAdmin, { email: 'jane@example.com' })
    const clockIn = new Date(Date.now() - 60 * 60000).toISOString() // 60 min ago
    queueFromResponses(supabaseAdmin, [
      { data: { id: 1 }, error: null },
      { data: { id: 55, clock_in: clockIn }, error: null },
      { data: { id: 55, clock_out: new Date().toISOString(), total_minutes: 60 }, error: null },
    ])
    const res = await POST(mockRequest({ token: 'good' }) as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.totalMinutes).toBeGreaterThanOrEqual(59)
    expect(body.totalMinutes).toBeLessThanOrEqual(61)
  })

  it('returns 500 when the update fails', async () => {
    mockAuthUser(supabaseAdmin, { email: 'jane@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { id: 1 }, error: null },
      { data: { id: 55, clock_in: new Date().toISOString() }, error: null },
      { data: null, error: { message: 'update failed' } },
    ])
    const res = await POST(mockRequest({ token: 'good' }) as never)
    expect(res.status).toBe(500)
  })
})
