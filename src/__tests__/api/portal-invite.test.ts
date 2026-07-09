// Integration test for POST /api/employee/portal-invite. Two external
// services are involved besides Supabase — supabaseAdmin.auth.admin.generateLink()
// (magic link) and Resend (email delivery) — both mocked at the boundary,
// same principle as supabaseAdmin itself: test our route logic, not the
// third-party SDKs.
jest.mock('../../app/lib/supabaseAdmin', () => ({
  supabaseAdmin: { auth: { getUser: jest.fn(), admin: { generateLink: jest.fn() } }, from: jest.fn() },
}))
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null }) },
  })),
}))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { POST } from '../../app/api/employee/portal-invite/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

function mockOwnerUser(user: { id: string } | null) {
  ;(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({ data: { user }, error: null })
}

function mockGenerateLink(result: { action_link?: string } | null, error: { message: string } | null = null) {
  ;(supabaseAdmin.auth.admin.generateLink as jest.Mock).mockResolvedValue({
    data: result ? { properties: result } : null,
    error,
  })
}

describe('POST /api/employee/portal-invite', () => {
  it('returns 400 when employeeId is missing', async () => {
    mockOwnerUser({ id: 'owner-1' })
    const res = await POST(mockRequest({ token: 'good', body: {} }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 404 when the employee does not belong to this owner or has no email', async () => {
    mockOwnerUser({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [{ data: null, error: null }])
    const res = await POST(mockRequest({ token: 'good', body: { employeeId: 5 } }) as never)
    expect(res.status).toBe(404)
  })

  it('returns 500 when the magic link cannot be generated', async () => {
    mockOwnerUser({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: { id: 5, name: 'Jane Doe', email: 'jane@example.com', role: 'Cashier' }, error: null },
      { data: { business_name: 'Joe\'s Diner' }, error: null },
    ])
    mockGenerateLink(null, { message: 'link generation failed' })
    const res = await POST(mockRequest({ token: 'good', body: { employeeId: 5 } }) as never)
    expect(res.status).toBe(500)
  })

  it('sends the invite email on success', async () => {
    mockOwnerUser({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: { id: 5, name: 'Jane Doe', email: 'jane@example.com', role: 'Cashier' }, error: null },
      { data: { business_name: 'Joe\'s Diner' }, error: null },
    ])
    mockGenerateLink({ action_link: 'https://example.com/magic-link' })
    const res = await POST(mockRequest({ token: 'good', body: { employeeId: 5 } }) as never)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })
})
