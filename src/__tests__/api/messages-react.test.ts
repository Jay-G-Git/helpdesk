jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))
jest.mock('../../app/lib/apiAuth', () => ({ getBearerUser: jest.fn() }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { getBearerUser } from '../../app/lib/apiAuth'
import { POST } from '../../app/api/messages/react/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

// JAY-82 — reacting to a message must be scoped to the caller's own
// business/channel membership, matching the check already in send/route.ts.
describe('POST /api/messages/react', () => {
  it('returns 401 without a token', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue(null)
    const res = await POST(mockRequest({ body: { messageId: 1, businessId: 'x', reaction: '👍' } }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 with missing fields', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    const res = await POST(mockRequest({ token: 'good', body: { messageId: 1 } }) as never)
    expect(res.status).toBe(400)
  })

  it('forbids reacting to a message belonging to a different business', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { business_id: 'other-biz', channel: 'general' }, error: null }, // chat_messages lookup — different business
    ])
    const res = await POST(mockRequest({ token: 'good', body: { messageId: 1, businessId: 'owner-1', reaction: '👍' } }) as never)
    expect(res.status).toBe(403)
  })

  it('forbids an employee from reacting in a group channel they are not a member of', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { business_id: 'owner-1', channel: 'group_9' }, error: null }, // chat_messages lookup
      { data: null, error: null }, // business_profiles — not an owner
      { data: { id: 5, name: 'Jordan Taylor' }, error: null }, // employee record
      { data: null, error: null }, // chat_channel_group_members — no membership
    ])
    const res = await POST(mockRequest({ token: 'good', body: { messageId: 1, businessId: 'owner-1', reaction: '👍' } }) as never)
    expect(res.status).toBe(403)
  })

  it('allows an employee to react in a channel they belong to', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { business_id: 'owner-1', channel: 'general' }, error: null }, // chat_messages lookup
      { data: null, error: null }, // business_profiles — not an owner
      { data: { id: 5, name: 'Jordan Taylor' }, error: null }, // employee record
      { data: null, error: null }, // existing reaction check — none
      { data: null, error: null }, // insert
    ])
    const res = await POST(mockRequest({ token: 'good', body: { messageId: 1, businessId: 'owner-1', reaction: '👍' } }) as never)
    expect(res.status).toBe(200)
  })

  it('allows the owner of the business to react', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'owner-1', email: 'owner@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { business_id: 'owner-1', channel: 'general' }, error: null }, // chat_messages lookup
      { data: { business_name: 'Acme' }, error: null }, // business_profiles — is the owner
      { data: null, error: null }, // existing reaction check — none
      { data: null, error: null }, // insert
    ])
    const res = await POST(mockRequest({ token: 'good', body: { messageId: 1, businessId: 'owner-1', reaction: '👍' } }) as never)
    expect(res.status).toBe(200)
  })
})
