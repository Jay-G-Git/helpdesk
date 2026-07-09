jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { PATCH } from '../../app/api/shifts/swaps/[id]/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function mockOwner(user: { id: string } | null) {
  ;(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({ data: { user } })
}

describe('PATCH /api/shifts/swaps/[id]', () => {
  it('returns 401 without a token', async () => {
    const res = await PATCH(mockRequest({ body: { status: 'approved' } }) as never, params('1'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for an invalid status', async () => {
    mockOwner({ id: 'owner-1' })
    const res = await PATCH(mockRequest({ token: 'good', body: { status: 'whatever' } }) as never, params('1'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when the swap does not belong to this owner', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [{ data: null, error: null }])
    const res = await PATCH(mockRequest({ token: 'good', body: { status: 'approved' } }) as never, params('1'))
    expect(res.status).toBe(404)
  })

  it('approves the swap', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: { id: 1 }, error: null },
      { data: null, error: null },
    ])
    const res = await PATCH(mockRequest({ token: 'good', body: { status: 'approved' } }) as never, params('1'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 500 when the update fails', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: { id: 1 }, error: null },
      { data: null, error: { message: 'update failed' } },
    ])
    const res = await PATCH(mockRequest({ token: 'good', body: { status: 'denied' } }) as never, params('1'))
    expect(res.status).toBe(500)
  })
})
