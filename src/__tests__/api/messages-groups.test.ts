jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))
jest.mock('../../app/lib/apiAuth', () => ({ getBearerUser: jest.fn() }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { getBearerUser } from '../../app/lib/apiAuth'
import { POST } from '../../app/api/messages/groups/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

// JAY-19 — owner-only creation of a manually named/curated group channel.
describe('POST /api/messages/groups', () => {
  it('returns 401 without a token', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue(null)
    const res = await POST(mockRequest() as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 when the caller is not an owner (no business_profiles row)', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'user-5', email: 'jordan@example.com' })
    queueFromResponses(supabaseAdmin, [{ data: null, error: null }]) // business_profiles lookup — not an owner
    const res = await POST(mockRequest({ token: 'good', body: { name: 'Kitchen', employeeIds: [1, 2] } }) as never)
    expect(res.status).toBe(403)
  })

  it('returns 400 when name is missing', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'owner-1', email: 'owner@example.com' })
    queueFromResponses(supabaseAdmin, [{ data: { user_id: 'owner-1' }, error: null }])
    const res = await POST(mockRequest({ token: 'good', body: { employeeIds: [1] } }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when no members are selected', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'owner-1', email: 'owner@example.com' })
    queueFromResponses(supabaseAdmin, [{ data: { user_id: 'owner-1' }, error: null }])
    const res = await POST(mockRequest({ token: 'good', body: { name: 'Kitchen', employeeIds: [] } }) as never)
    expect(res.status).toBe(400)
  })

  it('creates a group and inserts members for valid employee ids', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'owner-1', email: 'owner@example.com' })
    const fromMock = queueFromResponses(supabaseAdmin, [
      { data: { user_id: 'owner-1' }, error: null }, // business_profiles — is owner
      { data: [{ id: 1 }, { id: 2 }], error: null }, // valid employees belonging to this owner
      { data: { id: 9, name: 'Kitchen' }, error: null }, // chat_channel_groups insert
      { data: null, error: null }, // chat_channel_group_members insert
    ])
    const res = await POST(mockRequest({ token: 'good', body: { name: 'Kitchen', employeeIds: [1, 2] } }) as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.group).toEqual({ id: 9, name: 'Kitchen', memberIds: [1, 2] })

    const memberInsertBuilder = fromMock.mock.results[3].value
    expect(memberInsertBuilder.insert).toHaveBeenCalledWith([
      { group_id: 9, employee_id: 1 },
      { group_id: 9, employee_id: 2 },
    ])
  })

  it('drops employee ids that do not belong to this owner before inserting members', async () => {
    ;(getBearerUser as jest.Mock).mockResolvedValue({ id: 'owner-1', email: 'owner@example.com' })
    const fromMock = queueFromResponses(supabaseAdmin, [
      { data: { user_id: 'owner-1' }, error: null },
      { data: [{ id: 1 }], error: null }, // only id 1 actually belongs to this owner
      { data: { id: 9, name: 'Kitchen' }, error: null },
      { data: null, error: null },
    ])
    const res = await POST(mockRequest({ token: 'good', body: { name: 'Kitchen', employeeIds: [1, 999] } }) as never)
    expect(res.status).toBe(200)
    const memberInsertBuilder = fromMock.mock.results[3].value
    expect(memberInsertBuilder.insert).toHaveBeenCalledWith([{ group_id: 9, employee_id: 1 }])
  })
})
