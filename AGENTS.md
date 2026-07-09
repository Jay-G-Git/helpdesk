<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Testing protocol

See `TESTING.md` for the full protocol (unit vs. integration conventions, mocking patterns, coverage status).

**Standing rule: after any code change — bug fix, refactor, or new feature — check whether it needs new or updated tests, and add them.** This applies to both layers:

- New or changed logic in `src/lib/*.ts` → add/update a unit test in `src/__tests__/*.test.ts`.
- New or changed route handler in `src/app/api/**/route.ts` → add/update an integration test in `src/__tests__/api/*.test.ts`, following the mocking pattern in `src/__tests__/helpers/supabaseMock.ts`.

Don't wait to be asked. If a change doesn't need a test (e.g. a pure styling/UI tweak with no logic), say so briefly rather than skipping the check silently. Run `npm test` before considering any change done.

**Before every commit:** run the full suite (`npm test`) and confirm it passes. If any feature was added or changed since the last commit and doesn't have tests yet, write them now, per the rule above, then re-run the suite before committing. A local pre-commit hook enforces the "suite passes" half of this automatically — see below.
