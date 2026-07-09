# Testing Protocol

Two layers of automated tests, both run with Jest (`npm test`). Web app only for now — mobile app testing (Jest + React Native Testing Library) is a follow-up once the Expo app has more built out.

## Unit tests — `src/__tests__/*.test.ts`

Test pure functions in `src/lib/*.ts` in isolation. Two flavors:

- **Business logic** (no I/O): PTO math, shift scheduling, job posting helpers, password validation. No mocking needed — `auth.test.ts`, `pto.test.ts`, `jobs.test.ts`, `shifts.test.ts`.
- **External API wrappers** (Google Calendar, Gusto, QuickBooks): these are thin `fetch` wrappers with no business logic of their own, so the tests mock `global.fetch` and assert the request is built correctly (URL, method, headers, body) and that non-OK responses throw the right error — `googleCalendar.test.ts`, `gusto.test.ts`, `quickbooks.test.ts`.

Add one here whenever new logic lands in `src/lib/`. If a function needs a database or auth context to make sense, it belongs in `src/lib/` as a pure function that a route handler calls with data already fetched — not the other way around. That's what keeps this layer mockable and fast.

## Integration tests — `src/__tests__/api/*.test.ts`

Test the actual Next.js route handlers (`src/app/api/**/route.ts`) end to end: auth check → input validation → Supabase query orchestration → response status/shape.

**Supabase is mocked, not real.** `src/__tests__/helpers/supabaseMock.ts` provides:
- `mockAuthUser(admin, user)` — mocks `supabaseAdmin.auth.getUser()` for routes that look up an employee by email.
- For routes that authenticate by `user.id` directly (most owner-side routes), mock `supabaseAdmin.auth.getUser` manually per test file (see `swaps-approve.test.ts` for the pattern) since the user object needs an `id`, not an `email`.
- `queueFromResponses(admin, responses)` — one response per `.from(table)` call, consumed in the exact order the route calls them. Read the route once to get the call order right (some queries use `.single()`, others are awaited directly — the mock handles both identically).
- `mockRequest({ token, body, searchParams })` — a minimal `NextRequest`-like object.

A couple of routes need extra mocking beyond Supabase:
- **Resend** (email): `jest.mock('resend', () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: jest.fn()... } })) }))` — see `announcements.test.ts` or `portal-invite.test.ts`.
- **`@supabase/supabase-js` directly**: a couple of routes (`time-off/[id]`) create their own client via `createClient(...)` instead of reusing `supabaseAdmin` — mock the whole module in those cases (see `time-off-approve.test.ts`).

Why mocked instead of a real test Supabase project: it's fast (no network), deterministic (no shared test-database state to reset or flake on), free (no second Supabase project to provision and keep schema-synced with migrations), and runs anywhere — including sandboxes with no network access. The cost is it won't catch bugs in the actual SQL/RLS policies themselves. For a project this size, that's the right tradeoff: keep route-logic bugs cheap to catch via mocks, and catch real-DB issues via a manual smoke-test pass against a Supabase staging branch before releases. Don't reach for a real test database until mocking is visibly missing bugs.

One `describe` per route, one `it` per status code / branch (401 unauthenticated, 404 not found, 400 bad input, 409 conflict, 500 on DB error, 200 happy path).

## Running tests

```
npm test              # run once
npm run test:watch    # watch mode
```

## Coverage status

**Unit** — done: `auth.ts`, `pto.ts`, `jobs.ts`, `shifts.ts`, `googleCalendar.ts`, `gusto.ts`, `quickbooks.ts` (all 7 files in `src/lib/`).

**Integration** — done, all of `src/app/api/employee/*` (14 routes: `me`, `shifts`, `clock-in`, `clock-out`, `time-entries`, `time-off`, `pto-balance`, `open-shifts`, `claim-shift`, `coworker-shifts`, `swap-request`, `swap-requests`, `pay-stubs`, `portal-invite`) plus the owner-side routes that pair with them and a few high-traffic owner routes: `time-off/[id]` (approve/deny), `shifts/swaps/[id]` (approve/deny), `schedule/publish`, `employees/[id]` (cascade delete), `announcements`, `applications` (public submit + owner list), `applications/[id]` (status update + delete), `analytics`.

**Not yet covered** (same mocking pattern applies to all of these — it's a matter of reading each route once and queuing responses in call order):
- `messages/*` (10 routes — channels, threads, reactions, search, upload)
- `payroll/*` (4 routes — payroll runs, paystub/report PDF generation)
- `billing/*` (4 routes — Stripe checkout/portal/status/webhook; webhook especially needs signature-verification mocking)
- `google/*`, `gusto/*`, `quickbooks/*` connect/callback/sync routes (OAuth flows — these call the newly-tested `src/lib/googleCalendar.ts` etc., so mock those lib functions rather than `fetch` directly)
- `ai/chat` (the AI assistant's tool-routing logic — high value once it's touched again, since it dispatches to many other routes)
- `sign/[token]/*` (5 routes — onboarding document flow)
- `settings/*`, `team/*`, `portal/*`, `onboarding*`, `seed-demo`, `palette`, `checkout`, `generate`, `auth/*`

Add these incrementally as those areas get touched (see the standing instruction in `AGENTS.md`), or in a dedicated pass if you want full coverage sooner.
