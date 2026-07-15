jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { GET } from '../../app/api/dashboard/pending-approvals/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

function mockOwner(user: { id: string } | null) {
  ;(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({ data: { user } })
}

describe('GET /api/dashboard/pending-approvals', () => {
  it('returns 401 without a token', async () => {
    const res = await GET(mockRequest() as never)
    expect(res.status).toBe(401)
  })

  it('returns empty lists when nothing is pending', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: [], error: null }, // time_off_requests
      { data: [], error: null }, // shift_swaps
      { data: [], error: null }, // shifts (callouts)
      { data: [], error: null }, // employees
    ])
    const res = await GET(mockRequest({ token: 'good' }) as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ timeOff: [], swaps: [], callouts: [] })
  })

  it('resolves employee names and shift dates for pending items', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: [{ id: 1, employee_id: 10, start_date: '2026-07-20', end_date: '2026-07-22', type: 'vacation', reason: 'trip', created_at: '2026-07-14T00:00:00Z' }], error: null },
      { data: [{ id: 2, requester_employee_id: 10, target_employee_id: 11, requester_shift_id: 99, created_at: '2026-07-14T00:00:00Z' }], error: null },
      { data: [{ id: 3, employee_id: 11, start_time: '07:00', end_time: '15:00' }], error: null },
      { data: [{ id: 10, name: 'Jordan T.', role: 'Cashier' }, { id: 11, name: 'Casey R.', role: 'Lead' }], error: null },
      { data: [{ id: 99, shift_date: '2026-07-18' }], error: null },
    ])
    const res = await GET(mockRequest({ token: 'good' }) as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.timeOff).toEqual([{ id: 1, employee_name: 'Jordan T.', start_date: '2026-07-20', end_date: '2026-07-22', type: 'vacation', reason: 'trip' }])
    expect(body.swaps).toEqual([{ id: 2, requester_name: 'Jordan T.', target_name: 'Casey R.', shift_date: '2026-07-18', created_at: '2026-07-14T00:00:00Z' }])
    expect(body.callouts).toEqual([{ id: 3, employee_name: 'Casey R.', employee_role: 'Lead', start_time: '07:00', end_time: '15:00' }])
  })
})
