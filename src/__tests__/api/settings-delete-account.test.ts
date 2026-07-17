jest.mock('../../app/lib/supabaseAdmin', () => ({
  supabaseAdmin: { auth: { getUser: jest.fn(), admin: { deleteUser: jest.fn() } }, from: jest.fn() },
}))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { DELETE } from '../../app/api/settings/delete-account/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'

function mockOwner(user: { id: string } | null) {
  ;(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({ data: { user } })
}

const CASCADE_TABLES = [
  'payroll_entries', 'payroll_run_items', 'payroll_runs', 'shifts', 'time_off_requests',
  'notifications', 'employee_forms', 'onboarding_links', 'employees', 'onboarding_templates',
  'job_postings', 'gusto_connections', 'google_connections', 'quickbooks_connections',
  'team_members', 'business_profiles', 'notification_preferences',
]

describe('DELETE /api/settings/delete-account', () => {
  it('returns 401 without a token', async () => {
    const res = await DELETE(mockRequest() as never)
    expect(res.status).toBe(401)
  })

  it('cascades deletes across all related tables, including payroll_run_items and payroll_runs, before deleting the auth user', async () => {
    mockOwner({ id: 'owner-1' })
    const fromMock = queueFromResponses(
      supabaseAdmin,
      CASCADE_TABLES.map(() => ({ data: null, error: null }))
    )
    ;(supabaseAdmin.auth.admin.deleteUser as jest.Mock).mockResolvedValue({ data: {}, error: null })

    const res = await DELETE(mockRequest({ token: 'good' }) as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(fromMock.mock.calls.map((c: unknown[]) => c[0])).toEqual(CASCADE_TABLES)
    expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith('owner-1')
  })

  it('returns 500 when a payroll_run_items row still exists (FK would otherwise block the employees delete)', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // payroll_entries
      { data: null, error: { message: 'update or delete on table "payroll_run_items" violates foreign key constraint' } },
    ])

    const res = await DELETE(mockRequest({ token: 'good' }) as never)
    expect(res.status).toBe(500)
  })

  it('returns 500 when deleting the auth user fails', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(
      supabaseAdmin,
      CASCADE_TABLES.map(() => ({ data: null, error: null }))
    )
    ;(supabaseAdmin.auth.admin.deleteUser as jest.Mock).mockResolvedValue({ data: null, error: { message: 'auth delete failed' } })

    const res = await DELETE(mockRequest({ token: 'good' }) as never)
    expect(res.status).toBe(500)
  })
})
