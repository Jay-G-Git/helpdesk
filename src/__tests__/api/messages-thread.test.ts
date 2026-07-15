jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))
jest.mock('../../app/lib/apiAuth', () => ({ getBearerUser: jest.fn() }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { getBearerUser } from '../../app/lib/apiAuth'
import { GET } from '../../app/api/messages/thread/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

// JAY-19 — same group-membership gate as send/route.ts, applied to reads.
describe('GET /api/messages/thread', () => {
  it('returns 401 without a token', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue(null)
    const res = await GET(mockRequest({ searchParams: { channel: 'general', businessId: 'x' } }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 with missing params', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    const res = await GET(mockRequest({ token: 'good', searchParams: { channel: 'general' } }) as never)
    expect(res.status).toBe(400)
  })

  it('allows an employee to read a group channel they are a member of', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // business_profiles — not an owner
      { data: { id: 5 }, error: null }, // employee record
      { data: { id: 1 }, error: null }, // membership check — is a member
      { data: [], error: null }, // chat_messages select
    ])
    const res = await GET(mockRequest({ token: 'good', searchParams: { channel: 'group_9', businessId: 'owner-1' } }) as never)
    expect(res.status).toBe(200)
  })

  it('forbids an employee from reading a group channel they are not a member of', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // business_profiles — not an owner
      { data: { id: 5 }, error: null }, // employee record
      { data: null, error: null }, // membership check — not a member
    ])
    const res = await GET(mockRequest({ token: 'good', searchParams: { channel: 'group_9', businessId: 'owner-1' } }) as never)
    expect(res.status).toBe(403)
  })
})
