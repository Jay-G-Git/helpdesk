const isProd = process.env.NODE_ENV === 'production'

const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const QB_API_BASE = isProd
  ? 'https://quickbooks.api.intuit.com/v3/company'
  : 'https://sandbox-quickbooks.api.intuit.com/v3/company'

export { QB_AUTH_URL }

export async function exchangeCodeForTokens(code: string) {
  const credentials = Buffer.from(
    `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      code,
      redirect_uri: process.env.QB_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`QB token exchange failed: ${await res.text()}`)
  return res.json() as Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
    x_refresh_token_expires_in: number
  }>
}

export async function refreshAccessToken(refreshToken: string) {
  const credentials = Buffer.from(
    `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`QB token refresh failed: ${await res.text()}`)
  return res.json() as Promise<{ access_token: string; expires_in: number }>
}

async function qbRequest(method: string, realmId: string, path: string, accessToken: string, body?: object) {
  const res = await fetch(`${QB_API_BASE}/${realmId}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`QB API error ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function getCompanyInfo(realmId: string, accessToken: string) {
  return qbRequest('GET', realmId, '/companyinfo/' + realmId, accessToken)
}

/**
 * Create a simple expense (Purchase) in QuickBooks representing a payroll payment.
 * Uses "Checking" account by name; QB will match to the default account.
 */
export async function createPayrollExpense(
  realmId: string,
  accessToken: string,
  employeeName: string,
  amount: number,
  txnDate: string, // YYYY-MM-DD
  memo: string,
) {
  return qbRequest('POST', realmId, '/purchase', accessToken, {
    PaymentType: 'Check',
    AccountRef: { name: 'Checking' },
    TxnDate: txnDate,
    PrivateNote: memo,
    EntityRef: { name: employeeName, type: 'Employee' },
    Line: [
      {
        Amount: amount,
        DetailType: 'AccountBasedExpenseLineDetail',
        AccountBasedExpenseLineDetail: {
          AccountRef: { name: 'Payroll Expenses' },
          BillableStatus: 'NotBillable',
        },
        Description: memo,
      },
    ],
  })
}
