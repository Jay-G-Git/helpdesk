// Shared helper for integration-testing API routes without touching a real
// Supabase project. Route handlers call supabaseAdmin.from(table).select()
// .eq()...single() — this builds a chainable stand-in for that query builder
// so route logic (auth checks, validation, response shape) can be tested
// deterministically and offline.
//
// Usage in a test file:
//
//   jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: {}, from: jest.fn() } }))
//   import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
//   import { mockAuthUser, queueFromResponses } from './helpers/supabaseMock'
//
//   mockAuthUser(supabaseAdmin, { email: 'test@example.com' })
//   queueFromResponses(supabaseAdmin, [
//     { data: { id: 1 }, error: null },       // first .from(...) call in the route
//     { data: [{ id: 2 }], error: null },     // second .from(...) call, etc.
//   ])

type SupabaseResponse<T = unknown> = { data: T; error: { message: string } | null }

const CHAIN_METHODS = [
  'select', 'insert', 'update', 'delete', 'upsert',
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is', 'not',
  'order', 'limit', 'range',
]

/** One queued response per call to `.from(...)`, consumed in call order. */
export function queueFromResponses(admin: { from: unknown }, responses: SupabaseResponse[]) {
  let i = 0
  const fromMock = jest.fn(() => {
    const response = responses[i] ?? { data: null, error: null }
    i += 1
    const builder: Record<string, unknown> = {}
    for (const method of CHAIN_METHODS) {
      builder[method] = jest.fn(() => builder)
    }
    builder.single = jest.fn(() => Promise.resolve(response))
    builder.maybeSingle = jest.fn(() => Promise.resolve(response))
    // Some queries are awaited directly without .single(), e.g. `await
    // supabaseAdmin.from(...).select(...)` — make the builder itself thenable.
    builder.then = (resolve: (v: SupabaseResponse) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(response).then(resolve, reject)
    return builder
  })
  ;(admin as { from: jest.Mock }).from = fromMock
  return fromMock
}

/** Mocks supabaseAdmin.auth.getUser(token) to resolve to a given user (or null = unauthenticated). */
export function mockAuthUser(admin: { auth: unknown }, user: { email: string } | null) {
  const getUser = jest.fn(() => Promise.resolve({ data: { user }, error: null }))
  ;(admin as { auth: { getUser: jest.Mock } }).auth = {
    ...(admin as { auth: object }).auth,
    getUser,
  }
  return getUser
}

/** Builds a NextRequest-like object with just what route handlers read: headers, json body, and (optionally) query params via nextUrl.searchParams. */
export function mockRequest(opts: { token?: string; body?: unknown; searchParams?: Record<string, string> } = {}) {
  const params = new URLSearchParams(opts.searchParams ?? {})
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'authorization' && opts.token ? `Bearer ${opts.token}` : null),
    },
    json: async () => opts.body ?? {},
    nextUrl: { searchParams: params },
  }
}
