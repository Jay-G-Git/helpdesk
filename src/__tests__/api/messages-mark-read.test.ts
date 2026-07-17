jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))
jest.mock('../../app/lib/apiAuth', () => ({ getBearerUser: jest.fn() }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { getBearerUser } from '../../app/lib/apiAuth'
import { POST } from '../../app/api/messages/mark-read/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

// JAY-82 — marking a channel read must be scoped to the caller's own
// business/channel membership, matching the check already in send/route.ts.
describe('POST /api/messages/mark-read', () => {
  it('returns 401 without a token', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue(null)
    const res = await POST(mockRequest({ body: { channel: 'general', businessId: 'x' } }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 with missing fields', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    const res = await POST(mockRequest({ token: 'good', body: { channel: 'general' } }) as never)
    expect(res.status).toBe(400)
  })

  it('forbids an employee from marking read a business they do not belong to', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // business_profiles — not an owner
      { data: null, error: null }, // employees — no matching employee for this business
    ])
    const res = await POST(mockRequest({ token: 'good', body: { channel: 'general', businessId: 'owner-1' } }) as never)
    expect(res.status).toBe(403)
  })

  it('forbids an employee from marking read a group channel they are not a member of', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // business_profiles — not an owner
      { data: { id: 5 }, error: null }, // employee record
      { data: null, error: null }, // chat_channel_group_members — no membership
    ])
    const res = await POST(mockRequest({ token: 'good', body: { channel: 'group_9', businessId: 'owner-1' } }) as never)
    expect(res.status).toBe(403)
  })

  it('allows an employee to mark read a channel they belong to', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // business_profiles — not an owner
      { data: { id: 5 }, error: null }, // employee record
      { data: null, error: null }, // upsert
    ])
    const res = await POST(mockRequest({ token: 'good', body: { channel: 'general', businessId: 'owner-1' } }) as never)
    expect(res.status).toBe(200)
  })

  it('allows the owner of the business to mark read', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'owner-1', email: 'owner@example.com' })
    queueFromResponses(supabaseAdmin, [
      { data: { user_id: 'owner-1' }, error: null }, // business_profiles — is the owner
      { data: null, error: null }, // upsert
    ])
    const res = await POST(mockRequest({ token: 'good', body: { channel: 'general', businessId: 'owner-1' } }) as never)
    expect(res.status).toBe(200)
  })
})
