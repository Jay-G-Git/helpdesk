jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { POST } from '../../app/api/generate/route'
import { mockRequest } from '../helpers/supabaseMock'

function mockOwner(user: { id: string } | null) {
  ;(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({ data: { user } })
}

beforeEach(() => {
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('POST /api/generate', () => {
  it('returns 401 without a Bearer token, and never calls the Anthropic API', async () => {
    const res = await POST(mockRequest({ body: { action: 'checkin', employee: { name: 'Jane', role: 'Cashier' } } }) as never)
    expect(res.status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('calls the Anthropic API and returns generated text once authenticated', async () => {
    mockOwner({ id: 'owner-1' })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ content: [{ text: 'Great job, Jane!' }] }),
    })
    const res = await POST(mockRequest({
      token: 'good',
      body: { action: 'checkin', employee: { name: 'Jane', role: 'Cashier' }, notes: 'Doing well' },
    }) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.text).toBe('Great job, Jane!')
    expect(global.fetch).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', expect.objectContaining({ method: 'POST' }))
  })
})
