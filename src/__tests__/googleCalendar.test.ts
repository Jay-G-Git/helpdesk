// Unit tests for src/lib/googleCalendar.ts. Every function here is a thin
// wrapper around `fetch` calling Google's OAuth/Calendar APIs — there's no
// business logic to test without a real Google account, so these tests mock
// global.fetch and assert the request is built correctly (URL, method,
// body) and that non-OK responses throw. Same principle as mocking
// supabaseAdmin for API routes: test our code's boundary with the external
// service, not the service itself.
import {
  exchangeCodeForTokens,
  refreshAccessToken,
  createCalendarEvent,
  GOOGLE_AUTH_URL,
} from '../lib/googleCalendar'

const originalEnv = process.env

beforeEach(() => {
  process.env = {
    ...originalEnv,
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_REDIRECT_URI: 'https://example.com/callback',
  }
  global.fetch = jest.fn()
})

afterEach(() => {
  process.env = originalEnv
  jest.resetAllMocks()
})

describe('GOOGLE_AUTH_URL', () => {
  it('points at Google\'s OAuth consent screen', () => {
    expect(GOOGLE_AUTH_URL).toBe('https://accounts.google.com/o/oauth2/v2/auth')
  })
})

describe('exchangeCodeForTokens', () => {
  it('posts the auth code and credentials to the token endpoint', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, token_type: 'Bearer' }),
    })
    const result = await exchangeCodeForTokens('auth-code')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' })
    )
    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams
    expect(body.get('code')).toBe('auth-code')
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(result.access_token).toBe('at')
  })

  it('throws when the token exchange fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, text: async () => 'bad request' })
    await expect(exchangeCodeForTokens('bad-code')).rejects.toThrow('Google token exchange failed')
  })
})

describe('refreshAccessToken', () => {
  it('posts the refresh token with grant_type refresh_token', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ access_token: 'new-at', expires_in: 3600 }) })
    await refreshAccessToken('refresh-token')
    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams
    expect(body.get('refresh_token')).toBe('refresh-token')
    expect(body.get('grant_type')).toBe('refresh_token')
  })

  it('throws when the refresh fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, text: async () => 'expired' })
    await expect(refreshAccessToken('bad-refresh')).rejects.toThrow('Google token refresh failed')
  })
})

describe('createCalendarEvent', () => {
  it('builds an event with correct start/end datetimes and attendees', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ id: 'event-1' }) })
    await createCalendarEvent(
      'access-token', 'Shift', 'Cashier shift', '2026-07-10', '09:00:00', '17:00:00',
      'America/New_York', ['jane@example.com']
    )
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('https://www.googleapis.com/calendar/v3/calendars/primary/events')
    const body = JSON.parse(init.body)
    expect(body.start.dateTime).toBe('2026-07-10T09:00:00')
    expect(body.end.dateTime).toBe('2026-07-10T17:00:00')
    expect(body.attendees).toEqual([{ email: 'jane@example.com' }])
    expect(body.sendUpdates).toBe('all')
  })

  it('sends updates: none when there are no attendees', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ id: 'event-2' }) })
    await createCalendarEvent('access-token', 'Shift', 'desc', '2026-07-10', '09:00:00', '17:00:00')
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(body.sendUpdates).toBe('none')
  })

  it('throws on a non-OK response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 403, text: async () => 'forbidden' })
    await expect(
      createCalendarEvent('access-token', 'Shift', 'desc', '2026-07-10', '09:00:00', '17:00:00')
    ).rejects.toThrow('Google API error 403')
  })
})
