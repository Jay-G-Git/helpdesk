const GUSTO_BASE = process.env.NODE_ENV === 'production'
  ? 'https://api.gusto.com'
  : 'https://api.gusto-demo.com'

export const GUSTO_AUTH_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.gusto.com/oauth/authorize'
  : 'https://api.gusto-demo.com/oauth/authorize'

export const GUSTO_TOKEN_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.gusto.com/oauth/token'
  : 'https://api.gusto-demo.com/oauth/token'

export const GUSTO_API_VERSION = '2024-04-01'

export type GustoTokens = {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export async function exchangeCodeForTokens(code: string): Promise<GustoTokens> {
  const res = await fetch(GUSTO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GUSTO_CLIENT_ID!,
      client_secret: process.env.GUSTO_CLIENT_SECRET!,
      redirect_uri: process.env.GUSTO_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Gusto token exchange failed: ${res.status}`)
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<GustoTokens> {
  const res = await fetch(GUSTO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GUSTO_CLIENT_ID!,
      client_secret: process.env.GUSTO_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Gusto token refresh failed: ${res.status}`)
  return res.json()
}

export async function gustoGet(path: string, accessToken: string) {
  const res = await fetch(`${GUSTO_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Gusto-API-Version': GUSTO_API_VERSION,
    },
  })
  if (!res.ok) throw new Error(`Gusto GET ${path} failed: ${res.status}`)
  return res.json()
}

export async function gustoPost(path: string, accessToken: string, body: object) {
  const res = await fetch(`${GUSTO_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Gusto-API-Version': GUSTO_API_VERSION,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gusto POST ${path} failed: ${res.status} — ${text}`)
  }
  return res.json()
}

export async function getCurrentUser(accessToken: string) {
  return gustoGet('/v1/me', accessToken)
}

export async function getCompanyEmployees(companyUuid: string, accessToken: string) {
  return gustoGet(`/v1/companies/${companyUuid}/employees`, accessToken)
}

export async function createEmployee(companyUuid: string, accessToken: string, data: {
  first_name: string
  last_name: string
  email?: string
  start_date?: string
}) {
  return gustoPost(`/v1/companies/${companyUuid}/employees`, accessToken, data)
}

export async function getPayrolls(companyUuid: string, accessToken: string) {
  return gustoGet(`/v1/companies/${companyUuid}/payrolls?processed=true`, accessToken)
}
