jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))
jest.mock('../../app/lib/apiAuth', () => ({ getBearerUser: jest.fn() }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { getBearerUser } from '../../app/lib/apiAuth'
import { GET } from '../../app/api/messages/replies/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

// JAY-146 — tenant check mirroring thread/route.ts, closing an IDOR where any
// caller could read another business's replies by supplying its businessId.
describe('GET /api/messages/replies', () => {
  it('returns 401 without a token', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue(null)
    const res = await GET(mockRequest({ searchParams: { parentId: '1', businessId: 'x' } }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 with missing params', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    const res = await GET(mockRequest({ token: 'good', searchParams: { parentId: '1' } }) as never)
    expect(res.status).toBe(400)
  })

  it('forbids a caller who is neither owner nor employee of the target business', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // business_profiles — not an owner
      { data: null, error: null }, // employees — not an employee of this business
    ])
    const res = await GET(mockRequest({ token: 'good', searchParams: { parentId: '1', businessId: 'owner-1' } }) as never)
    expect(res.status).toBe(403)
  })

  it('allows the business owner to read replies in their own business', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'owner-1', email: 'owner@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { user_id: 'owner-1' }, error: null }, // business_profiles — is an owner
      { data: [], error: null }, // chat_messages
    ])
    const res = await GET(mockRequest({ token: 'good', searchParams: { parentId: '1', businessId: 'owner-1' } }) as never)
    expect(res.status).toBe(200)
  })

  it('allows an employee of the business to read replies in that business', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // business_profiles — not an owner
      { data: { id: 5 }, error: null }, // employees — is an employee of this business
      { data: [], error: null }, // chat_messages
    ])
    const res = await GET(mockRequest({ token: 'good', searchParams: { parentId: '1', businessId: 'owner-1' } }) as never)
    expect(res.status).toBe(200)
  })
})
