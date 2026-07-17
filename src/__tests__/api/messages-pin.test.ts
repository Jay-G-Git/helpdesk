jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))
jest.mock('../../app/lib/apiAuth', () => ({ getBearerUser: jest.fn() }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { getBearerUser } from '../../app/lib/apiAuth'
import { POST } from '../../app/api/messages/pin/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

// JAY-83 — pinning/unpinning a message must be scoped to the caller's own
// business, matching the tenant check already added to react/mark-read.
describe('POST /api/messages/pin', () => {
  it('returns 401 without a token', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue(null)
    const res = await POST(mockRequest({ body: { messageId: 1, pin: true } }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 when the caller is not a business owner', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // business_profiles — not an owner
    ])
    const res = await POST(mockRequest({ token: 'good', body: { messageId: 1, pin: true } }) as never)
    expect(res.status).toBe(403)
  })

  it('forbids pinning a message belonging to a different business', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'owner-1', email: 'owner@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { user_id: 'owner-1' }, error: null }, // business_profiles — is an owner
      { data: { business_id: 'other-biz' }, error: null }, // chat_messages lookup — different business
    ])
    const res = await POST(mockRequest({ token: 'good', body: { messageId: 1, pin: true } }) as never)
    expect(res.status).toBe(403)
  })

  it('allows an owner to pin a message belonging to their own business', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'owner-1', email: 'owner@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { user_id: 'owner-1' }, error: null }, // business_profiles — is an owner
      { data: { business_id: 'owner-1' }, error: null }, // chat_messages lookup — same business
      { data: null, error: null }, // update
    ])
    const res = await POST(mockRequest({ token: 'good', body: { messageId: 1, pin: true } }) as never)
    expect(res.status).toBe(200)
  })
})
