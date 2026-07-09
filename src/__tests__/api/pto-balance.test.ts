// Integration test for GET /api/employee/pto-balance — exercises the real
// route handler (auth check → employee lookup → approved-request query →
// balance math) with Supabase mocked at the boundary. See
// src/__tests__/helpers/supabaseMock.ts for the mocking approach and why.
jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: {}, from: jest.fn() } }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { GET } from '../../app/api/employee/pto-balance/route'
import { mockAuthUser, queueFromResponses, mockRequest } from '../helpers/supabaseMock'

describe('GET /api/employee/pto-balance', () => {
  it('returns 401 when no Authorization header is sent', async () => {
    const res = await GET(mockRequest() as never)
    expect(res.status).toBe(401)
  })

  it('returns 401 when the token does not resolve to a user', async () => {
    mockAuthUser(supabaseAdmin, null)
    const res = await GET(mockRequest({ token: 'bad-token' }) as never)
    expect(res.status).toBe(401)
  })

  it('returns balance: null when no employee record matches the email', async () => {
    mockAuthUser(supabaseAdmin, { email: 'ghost@example.com' })
    queueFromResponses(supabaseAdmin, [{ data: [], error: null }])
    const res = await GET(mockRequest({ token: 'good-token' }) as never)
    const body = await res.json()
    expect(body).toEqual({ balance: null })
  })

  it('computes remaining PTO from total minus approved days this year', async () => {
    mockAuthUser(supabaseAdmin, { email: 'jane@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: [{ id: 1, name: 'Jane', pto_days_per_year: 15 }], error: null },
      { data: [{ start_date: '2026-07-06', end_date: '2026-07-10' }], error: null }, // 5 days
    ])
    const res = await GET(mockRequest({ token: 'good-token' }) as never)
    const body = await res.json()
    expect(body).toEqual({ balance: { total: 15, used: 5, remaining: 10 } })
  })

  it('clamps remaining to 0 when more days are used than allotted', async () => {
    mockAuthUser(supabaseAdmin, { email: 'jane@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: [{ id: 1, name: 'Jane', pto_days_per_year: 5 }], error: null },
      { data: [{ start_date: '2026-01-01', end_date: '2026-01-20' }], error: null }, // 20 days
    ])
    const res = await GET(mockRequest({ token: 'good-token' }) as never)
    const body = await res.json()
    expect(body.balance.remaining).toBe(0)
  })
})
