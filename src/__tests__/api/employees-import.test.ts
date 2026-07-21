jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { POST } from '../../app/api/employees/import/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

function mockOwner(user: { id: string } | null) {
  ;(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({ data: { user } })
}

describe('POST /api/employees/import', () => {
  it('returns 401 without a token', async () => {
    const res = await POST(mockRequest({ body: { rows: [{ name: 'Jane', role: 'Cashier' }] } }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when there are no rows', async () => {
    mockOwner({ id: 'owner-1' })
    const res = await POST(mockRequest({ token: 'good', body: { rows: [] } }) as never)
    expect(res.status).toBe(400)
  })

  it('inserts a valid batch scoped to the caller\'s own user_id', async () => {
    mockOwner({ id: 'owner-1' })
    const fromMock = queueFromResponses(supabaseAdmin, [
      { data: [], error: null }, // existing employees lookup
      {
        data: [
          { id: 1, name: 'Jane Smith', role: 'Cashier', user_id: 'owner-1' },
          { id: 2, name: 'John Doe', role: 'Manager', user_id: 'owner-1' },
        ],
        error: null,
      }, // insert
    ])
    const res = await POST(mockRequest({
      token: 'good',
      body: { rows: [{ name: 'Jane Smith', email: 'jane@example.com', role: 'Cashier' }, { name: 'John Doe', email: 'john@example.com', role: 'Manager' }] },
    }) as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.results).toEqual([
      { index: 0, success: true, employee: { id: 1, name: 'Jane Smith', role: 'Cashier', user_id: 'owner-1' } },
      { index: 1, success: true, employee: { id: 2, name: 'John Doe', role: 'Manager', user_id: 'owner-1' } },
    ])
    const insertCall = (fromMock.mock.results[1].value.insert as jest.Mock).mock.calls[0][0]
    expect(insertCall.every((r: { user_id: string }) => r.user_id === 'owner-1')).toBe(true)
  })

  it('rejects rows missing required name or role', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: [], error: null },
      { data: [{ id: 1, name: 'Jane Smith', role: 'Cashier' }], error: null },
    ])
    const res = await POST(mockRequest({
      token: 'good',
      body: { rows: [{ name: '', role: 'Cashier' }, { name: 'Jane Smith', role: 'Cashier' }] },
    }) as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.results[0]).toEqual({ index: 0, success: false, error: 'Missing required name or role' })
    expect(body.results[1]).toEqual({ index: 1, success: true, employee: { id: 1, name: 'Jane Smith', role: 'Cashier' } })
  })

  it('flags rows whose email already exists on the team instead of importing them', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: [{ email: 'existing@example.com' }], error: null },
    ])
    const res = await POST(mockRequest({
      token: 'good',
      body: { rows: [{ name: 'Jane Smith', email: 'Existing@Example.com', role: 'Cashier' }] },
    }) as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.results).toEqual([{ index: 0, success: false, error: 'Email already exists on your team' }])
  })

  it('flags duplicate emails within the same submitted batch', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: [], error: null },
      { data: [{ id: 1, name: 'Jane Smith', role: 'Cashier' }], error: null },
    ])
    const res = await POST(mockRequest({
      token: 'good',
      body: { rows: [
        { name: 'Jane Smith', email: 'jane@example.com', role: 'Cashier' },
        { name: 'Jane S', email: 'jane@example.com', role: 'Cashier' },
      ] },
    }) as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.results[0].success).toBe(true)
    expect(body.results[1]).toEqual({ index: 1, success: false, error: 'Email already exists on your team' })
  })
})
