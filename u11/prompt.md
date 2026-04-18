You are implementing US11 for MatchPoint.

INPUTS (read these first, in order):
1. user-stories2.md — section US11 (acceptance criteria are the contract)
2. u11/dev-spec.md — data model + endpoint shape
3. src/types.ts, src/store.ts, src/routes/*.ts — current backend conventions
4. frontend/src/api.ts, frontend/src/pages/* — current frontend conventions

CONSTRAINTS:
- Match existing patterns (Express routes, in-memory store, Zod validation, JWT middleware).
- No new top-level deps without flagging in the PR description.
- Every machine acceptance criterion must map to a vitest test in src/*.test.ts.
- UI changes need at least one Playwright/manual smoke step in u11/HumanTests.md.

OUTPUT (in this order, one task at a time — wait for me between each):
1. Type + store changes
2. Backend routes + middleware
3. Backend vitest tests (one criterion at a time)
4. Frontend api.ts client functions
5. Frontend page/component changes
6. Human-test checklist

After each step: stop, summarize what changed, and wait for "next".
