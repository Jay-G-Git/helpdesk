jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))
jest.mock('../../app/lib/apiAuth', () => ({ getBearerUser: jest.fn() }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { getBearerUser } from '../../app/lib/apiAuth'
import { POST } from '../../app/api/messages/send/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

// JAY-19 — employees may only post into a group_<id> channel they're an
// actual member of; general/DM behavior is unchanged.
describe('POST /api/messages/send', () => {
  it('returns 401 without a token', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue(null)
    const res = await POST(mockRequest({ body: { channel: 'general', businessId: 'x', content: 'hi' } }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 with missing fields', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    const res = await POST(mockRequest({ token: 'good', body: { channel: 'general' } }) as never)
    expect(res.status).toBe(400)
  })

  it('allows an employee to post into a group channel they are a member of', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // business_profiles — not an owner
      { data: { id: 5, name: 'Jordan Taylor' }, error: null }, // employee record
      { data: { id: 1 }, error: null }, // chat_channel_group_members membership check — is a member
      { data: { id: 100, channel: 'group_9', sender_name: 'Jordan Taylor', content: 'hey team' }, error: null }, // chat_messages insert
    ])
    const res = await POST(mockRequest({ token: 'good', body: { channel: 'group_9', businessId: 'owner-1', content: 'hey team' } }) as never)
    expect(res.status).toBe(200)
  })

  it('forbids an employee from posting into a group channel they are not a member of', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // business_profiles — not an owner
      { data: { id: 5, name: 'Jordan Taylor' }, error: null }, // employee record
      { data: null, error: null }, // chat_channel_group_members membership check — no row, not a member
    ])
    const res = await POST(mockRequest({ token: 'good', body: { channel: 'group_9', businessId: 'owner-1', content: 'hey team' } }) as never)
    expect(res.status).toBe(403)
  })

  it('still allows an employee to post into "general" without a group lookup', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    const fromMock = queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // business_profiles — not an owner
      { data: { id: 5, name: 'Jordan Taylor' }, error: null }, // employee record
      { data: { id: 100, channel: 'general', sender_name: 'Jordan Taylor', content: 'hi' }, error: null }, // chat_messages insert
    ])
    const res = await POST(mockRequest({ token: 'good', body: { channel: 'general', businessId: 'owner-1', content: 'hi' } }) as never)
    expect(res.status).toBe(200)
    // Only 3 .from() calls — no group-membership lookup for a non-group channel.
    expect(fromMock).toHaveBeenCalledTimes(3)
  })
})
