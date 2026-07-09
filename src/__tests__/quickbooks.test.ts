// Unit tests for src/lib/quickbooks.ts — same fetch-mocking approach as
// googleCalendar.test.ts and gusto.test.ts.
import { exchangeCodeForTokens, refreshAccessToken, createPayrollExpense, QB_AUTH_URL } from '../lib/quickbooks'

const originalEnv = process.env

beforeEach(() => {
  process.env = {
    ...originalEnv,
    QB_CLIENT_ID: 'client-id',
    QB_CLIENT_SECRET: 'client-secret',
    QB_REDIRECT_URI: 'https://example.com/callback',
  }
  global.fetch = jest.fn()
})

afterEach(() => {
  process.env = originalEnv
  jest.resetAllMocks()
})

describe('QB_AUTH_URL', () => {
  it('points at Intuit\'s OAuth consent screen', () => {
    expect(QB_AUTH_URL).toBe('https://appcenter.intuit.com/connect/oauth2')
  })
})

describe('exchangeCodeForTokens', () => {
  it('sends Basic auth with base64-encoded client credentials', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, x_refresh_token_expires_in: 8640000 }),
    })
    await exchangeCodeForTokens('auth-code')
    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    const expected = 'Basic ' + Buffer.from('client-id:client-secret').toString('base64')
    expect(init.headers.Authorization).toBe(expected)
  })

  it('throws when the token exchange fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, text: async () => 'invalid_grant' })
    await expect(exchangeCodeForTokens('bad-code')).rejects.toThrow('QB token exchange failed')
  })
})

describe('refreshAccessToken', () => {
  it('throws when the refresh fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, text: async () => 'expired' })
    await expect(refreshAccessToken('bad-refresh')).rejects.toThrow('QB token refresh failed')
  })
})

describe('createPayrollExpense', () => {
  it('builds a Purchase transaction with the right amount and employee', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ Purchase: { Id: '1' } }) })
    await createPayrollExpense('realm-1', 'access-token', 'Jane Doe', 500, '2026-07-10', 'Week of 7/6 payroll')
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('/realm-1/purchase')
    const body = JSON.parse(init.body)
    expect(body.EntityRef).toEqual({ name: 'Jane Doe', type: 'Employee' })
    expect(body.Line[0].Amount).toBe(500)
    expect(body.TxnDate).toBe('2026-07-10')
  })

  it('throws with status and body text on a non-OK response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 400, text: async () => 'bad account ref' })
    await expect(
      createPayrollExpense('realm-1', 'token', 'Jane', 500, '2026-07-10', 'memo')
    ).rejects.toThrow('QB API error 400')
  })
})
