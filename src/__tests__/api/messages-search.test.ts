jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))
jest.mock('../../app/lib/apiAuth', () => ({ getBearerUser: jest.fn() }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { getBearerUser } from '../../app/lib/apiAuth'
import { GET } from '../../app/api/messages/search/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

// JAY-146 — tenant check mirroring thread/route.ts, closing an IDOR where any
// caller could read another business's messages by supplying its businessId.
describe('GET /api/messages/search', () => {
  it('returns 401 without a token', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue(null)
    const res = await GET(mockRequest({ searchParams: { q: 'hello', businessId: 'x' } }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 with missing businessId', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    const res = await GET(mockRequest({ token: 'good', searchParams: { q: 'hello' } }) as never)
    expect(res.status).toBe(400)
  })

  it('forbids a caller who is neither owner nor employee of the target business', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // business_profiles — not an owner
      { data: null, error: null }, // employees — not an employee of this business
    ])
    const res = await GET(mockRequest({ token: 'good', searchParams: { q: 'hello', businessId: 'owner-1' } }) as never)
    expect(res.status).toBe(403)
  })

  it('allows the business owner to search their own messages', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'owner-1', email: 'owner@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { user_id: 'owner-1' }, error: null }, // business_profiles — is an owner
      { data: [{ id: 1, channel: 'general', sender_name: 'Owner', content: 'hello world', created_at: 'now' }], error: null }, // chat_messages
    ])
    const res = await GET(mockRequest({ token: 'good', searchParams: { q: 'hello', businessId: 'owner-1' } }) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(1)
  })

  it('allows an employee of the business to search its messages', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // business_profiles — not an owner
      { data: { id: 5 }, error: null }, // employees — is an employee of this business
      { data: [{ id: 1, channel: 'general', sender_name: 'Jordan', content: 'hello world', created_at: 'now' }], error: null }, // chat_messages
    ])
    const res = await GET(mockRequest({ token: 'good', searchParams: { q: 'hello', businessId: 'owner-1' } }) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(1)
  })
})
