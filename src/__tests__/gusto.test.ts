// Unit tests for src/lib/gusto.ts — same approach as googleCalendar.test.ts:
// mock global.fetch, assert request construction and error handling for
// this thin wrapper around Gusto's OAuth + Payroll API.
import {
  exchangeCodeForTokens,
  refreshAccessToken,
  gustoGet,
  gustoPost,
  GUSTO_TOKEN_URL,
  GUSTO_API_VERSION,
} from '../lib/gusto'

const originalEnv = process.env

beforeEach(() => {
  process.env = {
    ...originalEnv,
    GUSTO_CLIENT_ID: 'client-id',
    GUSTO_CLIENT_SECRET: 'client-secret',
    GUSTO_REDIRECT_URI: 'https://example.com/callback',
  }
  global.fetch = jest.fn()
})

afterEach(() => {
  process.env = originalEnv
  jest.resetAllMocks()
})

describe('exchangeCodeForTokens', () => {
  it('posts to the Gusto token endpoint with the auth code', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, token_type: 'Bearer' }),
    })
    const result = await exchangeCodeForTokens('auth-code')
    expect(global.fetch).toHaveBeenCalledWith(GUSTO_TOKEN_URL, expect.objectContaining({ method: 'POST' }))
    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams
    expect(body.get('code')).toBe('auth-code')
    expect(result.access_token).toBe('at')
  })

  it('throws with the status code when the exchange fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 400 })
    await expect(exchangeCodeForTokens('bad-code')).rejects.toThrow('Gusto token exchange failed: 400')
  })
})

describe('refreshAccessToken', () => {
  it('throws with the status code when the refresh fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 })
    await expect(refreshAccessToken('bad-token')).rejects.toThrow('Gusto token refresh failed: 401')
  })
})

describe('gustoGet', () => {
  it('sends the API version header', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) })
    await gustoGet('/v1/me', 'access-token')
    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(init.headers['X-Gusto-API-Version']).toBe(GUSTO_API_VERSION)
    expect(init.headers.Authorization).toBe('Bearer access-token')
  })

  it('throws on a non-OK response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 })
    await expect(gustoGet('/v1/me', 'bad-token')).rejects.toThrow('404')
  })
})

describe('gustoPost', () => {
  it('sends a JSON body with the API version header', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ id: 2 }) })
    await gustoPost('/v1/companies/abc/employees', 'access-token', { first_name: 'Jane' })
    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ first_name: 'Jane' })
  })

  it('includes the response text in the thrown error', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 422, text: async () => 'validation error' })
    await expect(gustoPost('/v1/companies/abc/employees', 'token', {})).rejects.toThrow('validation error')
  })
})
