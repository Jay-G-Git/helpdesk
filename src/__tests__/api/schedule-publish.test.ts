jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { POST } from '../../app/api/schedule/publish/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

function mockOwner(user: { id: string } | null) {
  ;(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({ data: { user } })
}

describe('POST /api/schedule/publish', () => {
  it('returns 401 without a token', async () => {
    const res = await POST(mockRequest({ body: { weekStart: '2026-07-06' } }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when weekStart is missing', async () => {
    mockOwner({ id: 'owner-1' })
    const res = await POST(mockRequest({ token: 'good', body: {} }) as never)
    expect(res.status).toBe(400)
  })

  it('returns notified: 0 when no shifts are scheduled that week', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: { business_name: 'Joe\'s Diner' }, error: null },
      { data: [], error: null },
    ])
    const res = await POST(mockRequest({ token: 'good', body: { weekStart: '2026-07-06' } }) as never)
    const body = await res.json()
    expect(body).toEqual({ notified: 0 })
  })

  it('notifies each unique employee with a scheduled shift', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: { business_name: 'Joe\'s Diner' }, error: null },
      { data: [{ employee_id: 1 }, { employee_id: 1 }, { employee_id: 2 }], error: null },
      { data: null, error: null }, // chat_messages insert
    ])
    const res = await POST(mockRequest({ token: 'good', body: { weekStart: '2026-07-06' } }) as never)
    const body = await res.json()
    expect(body.notified).toBe(2) // deduped
  })

  it('returns 500 when the notification insert fails', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null },
      { data: [{ employee_id: 1 }], error: null },
      { data: null, error: { message: 'insert failed' } },
    ])
    const res = await POST(mockRequest({ token: 'good', body: { weekStart: '2026-07-06' } }) as never)
    expect(res.status).toBe(500)
  })
})
