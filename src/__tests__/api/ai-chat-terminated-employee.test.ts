// JAY-91 — a terminated employee's Supabase Auth session stays valid
// indefinitely (JAY-43's own finding), so the AI assistant's tool-execution
// layer must independently re-check employee status rather than trusting a
// still-authenticated session. Mirrors the existing pattern in
// claim-shift/pay-stubs (`.eq('status', 'active')`, 403 on no match).
jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))
jest.mock('@anthropic-ai/sdk', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => ({})) }), { virtual: true })

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { getUserRole, executeTool } from '../../app/api/ai/chat/route'
import { queueFromResponses } from '../helpers/supabaseMock'

afterEach(() => {
  jest.resetAllMocks()
})

describe('getUserRole — terminated employee', () => {
  it('resolves isEmployee: false and employeeId: null when the employee row is terminated (filtered out by the active-status query)', async () => {
    // Query order inside getUserRole: business_profiles first, employees
    // second. A terminated employee's row is filtered out by `.eq('status',
    // 'active')`, so the query itself returns null — same shape as "no
    // employee record at all" (matches the pay-stubs/claim-shift precedent).
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // business_profiles — not an owner
      { data: null, error: null }, // employees — filtered out by status=active
    ])
    const role = await getUserRole('user-1', 'terminated@example.com')
    expect(role.isEmployee).toBe(false)
    expect(role.employeeId).toBeNull()
  })

  it('still resolves a currently-active employee normally', async () => {
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null },
      { data: { id: 'emp-1', name: 'Jane', user_id: 'owner-1' }, error: null },
    ])
    const role = await getUserRole('user-1', 'jane@example.com')
    expect(role.isEmployee).toBe(true)
    expect(role.employeeId).toBe('emp-1')
  })
})

describe('executeTool — blocks employee-scoped tools for a terminated employee', () => {
  const terminatedRole = {
    isOwner: false,
    isEmployee: false,
    businessName: null,
    employeeId: null,
    employeeName: null,
    ownerId: 'owner-1',
  } as never

  it.each(['get_pto_balance', 'request_time_off', 'clock_in', 'clock_out', 'get_my_schedule', 'get_my_time_off_requests'])(
    '%s refuses to run and never touches the database',
    async (tool) => {
      const fromMock = queueFromResponses(supabaseAdmin, [])
      const result = await executeTool(tool, {}, 'user-1', terminatedRole, 'America/New_York')
      expect(result).toMatch(/access revoked/i)
      expect(fromMock).not.toHaveBeenCalled()
    },
  )

  it('a valid active employee can still clock in normally (no regression)', async () => {
    const activeRole = {
      isOwner: false,
      isEmployee: true,
      businessName: null,
      employeeId: 'emp-1',
      employeeName: 'Jane',
      ownerId: 'owner-1',
    } as never
    const fromMock = queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // no open time_entries
      { data: { start_time: '09:00', end_time: '17:00' }, error: null }, // today's shift
      { data: null, error: null }, // time_entries insert
    ])
    const result = await executeTool('clock_in', {}, 'user-1', activeRole, 'America/New_York')
    expect(fromMock).toHaveBeenCalled()
    expect(result).toContain('Clocked in')
  })
})
