jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { PATCH, DELETE } from '../../app/api/applications/[id]/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function mockOwner(user: { id: string } | null) {
  ;(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({ data: { user } })
}

describe('PATCH /api/applications/[id]', () => {
  it('returns 401 without a token', async () => {
    const res = await PATCH(mockRequest({ body: { status: 'hired' } }) as never, params('1'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for an invalid status', async () => {
    mockOwner({ id: 'owner-1' })
    const res = await PATCH(mockRequest({ token: 'good', body: { status: 'ghosted' } }) as never, params('1'))
    expect(res.status).toBe(400)
  })

  it('updates the application status', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [{ data: null, error: null }])
    const res = await PATCH(mockRequest({ token: 'good', body: { status: 'interviewing' } }) as never, params('1'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })
})

describe('DELETE /api/applications/[id]', () => {
  it('returns 401 without a token', async () => {
    const res = await DELETE(mockRequest() as never, params('1'))
    expect(res.status).toBe(401)
  })

  it('deletes the application', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [{ data: null, error: null }])
    const res = await DELETE(mockRequest({ token: 'good' }) as never, params('1'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 500 when the delete fails', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [{ data: null, error: { message: 'delete failed' } }])
    const res = await DELETE(mockRequest({ token: 'good' }) as never, params('1'))
    expect(res.status).toBe(500)
  })
})
