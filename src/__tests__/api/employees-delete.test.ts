jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { DELETE } from '../../app/api/employees/[id]/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function mockOwner(user: { id: string } | null) {
  ;(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({ data: { user } })
}

describe('DELETE /api/employees/[id]', () => {
  it('returns 401 without a token', async () => {
    const res = await DELETE(mockRequest() as never, params('5'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when the employee does not belong to this owner', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [{ data: null, error: null }])
    const res = await DELETE(mockRequest({ token: 'good' }) as never, params('5'))
    expect(res.status).toBe(404)
  })

  it('cascades deletes across all related tables before deleting the employee', async () => {
    mockOwner({ id: 'owner-1' })
    const fromMock = queueFromResponses(supabaseAdmin, [
      { data: { id: 5 }, error: null }, // ownership check
      { data: null, error: null }, // department_members
      { data: null, error: null }, // time_off_requests
      { data: null, error: null }, // time_entries
      { data: null, error: null }, // shifts
      { data: null, error: null }, // shift_swaps requester
      { data: null, error: null }, // shift_swaps target
      { data: null, error: null }, // payroll_entries
      { data: null, error: null }, // final employees delete
    ])
    const res = await DELETE(mockRequest({ token: 'good' }) as never, params('5'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(fromMock.mock.calls.map(c => c[0])).toEqual([
      'employees', 'department_members', 'time_off_requests', 'time_entries',
      'shifts', 'shift_swaps', 'shift_swaps', 'payroll_entries', 'employees',
    ])
  })

  it('returns 500 when the final delete fails', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: { id: 5 }, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: { message: 'delete failed' } },
    ])
    const res = await DELETE(mockRequest({ token: 'good' }) as never, params('5'))
    expect(res.status).toBe(500)
  })
})
