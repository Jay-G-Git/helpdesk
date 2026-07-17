jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))
jest.mock('@anthropic-ai/sdk', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => ({})) }), { virtual: true })

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { executeTool } from '../../app/api/ai/chat/route'
import { queueFromResponses } from '../helpers/supabaseMock'

const role = {
  isOwner: false,
  isEmployee: true,
  businessName: null,
  employeeId: 'emp-1',
  employeeName: 'Jane',
  ownerId: 'owner-1',
} as never

afterEach(() => {
  jest.resetAllMocks()
})

describe('AI assistant schedule tools', () => {
  it('clock_in reads today\'s shift from the shifts table, not the nonexistent schedules table', async () => {
    const fromMock = queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // open time_entries check
      { data: { start_time: '09:00', end_time: '17:00' }, error: null }, // shift lookup
      { data: null, error: null }, // time_entries insert
    ])
    const result = await executeTool('clock_in', {}, 'user-1', role, 'America/New_York')
    expect(fromMock).toHaveBeenCalledWith('shifts')
    expect(fromMock).not.toHaveBeenCalledWith('schedules')
    expect(result).toContain('09:00–17:00')
  })

  it('get_my_schedule reads upcoming shifts from the shifts table, not the nonexistent schedules table', async () => {
    const fromMock = queueFromResponses(supabaseAdmin, [
      { data: [{ shift_date: '2026-07-20', start_time: '09:00', end_time: '17:00', notes: null }], error: null },
    ])
    const result = await executeTool('get_my_schedule', {}, 'user-1', role, 'America/New_York')
    expect(fromMock).toHaveBeenCalledWith('shifts')
    expect(fromMock).not.toHaveBeenCalledWith('schedules')
    expect(result).toContain('2026-07-20: 09:00–17:00')
  })
})
