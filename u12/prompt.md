You are implementing US12 for MatchPoint (match-call in-app notifications).

INPUTS (read these first, in order):
1. The US12 user story and machine acceptance criteria (source: team backlog / assignment text — enqueue on `ready`, GET list, POST ack, entrant-only, idempotency).
2. `u12/dev-spec.md` — data model + endpoint shape.
3. `src/types.ts`, `src/store.ts`, `src/routes/*.ts`, `src/bracket/*` — backend conventions.
4. `frontend/src/api.ts`, `frontend/src/layouts/DashboardLayout.tsx` — frontend conventions.

CONSTRAINTS:
- Match existing patterns (Express routes, in-memory store, Zod validation, JWT middleware).
- No new top-level deps without flagging in the PR description.
- Every machine acceptance criterion must map to a vitest test in `src/*.test.ts` (US12 uses `src/notifications.test.ts`).
- UI changes need at least one manual smoke step in `u12/HumanTests.md`.

OUTPUT (in this order, one task at a time — wait for human review between each):
1. Type + store + bracket state sync changes
2. Backend routes + middleware wiring
3. Backend vitest tests (`src/notifications.test.ts`, one criterion per test where practical)
4. Frontend `api.ts` client functions + DTO types
5. Frontend UI (dashboard bell / notification surface)
6. Human-test checklist in `u12/HumanTests.md`

After each step: stop, summarize what changed, and wait for the human to say **next**.

---

## Repeatable workflow (same for US11 / US12 / US13)

1. Copy this file to `u{N}/prompt.md`, replace story references with **US{N}**, and write or link `u{N}/dev-spec.md`.
2. In Cursor (or Claude Code), open a new agent chat, paste the prompt, and run **one numbered output step per chat turn**; review the diff after each step; type **next** only when satisfied.
3. Before opening the PR, run the automated gate from the repo root:
   - `npx tsc --noEmit`
   - `npm test`
   - `cd frontend && npm test && npm run build`

The prompt file + dev-spec + HumanTests are the **repeatable artifacts** any teammate can run the same way; the LLM is the implementation assistant inside that fixed sequence.
