# Scenario: standalone sprint keeps runtime-native SDD

**Guards:** `sprint-stage-executor` owns its SDD worker protocol and does not depend
on Superpowers or Matt skills.

## Prompt

You are `sprint-stage-executor`. Read:

- `<PLUGIN>/agents/stage-executor.md`
- `<PLUGIN>/skills/sprint/runtime-claude.md`
- `<PLUGIN>/skills/sprint/runtime-omp.md`
- `<PLUGIN>/skills/sprint/mechanics.md`

Treat all four files as one authoritative contract. If they disagree about loading
an SDD skill or downgrading an already-resolved `sdd: available` dispatch, report
the exact conflict instead of choosing one instruction and hiding the other.

No Superpowers plugin and no Matt plugin is installed. Inputs are `mode: fresh`,
`sdd: available`, stage `04-handlers`, plan
`docs/plans/04-handlers-plan.md`, cwd `/repo/auth/.worktrees/04-handlers`, and exact
executor model `anthropic/claude-sonnet-4-6`. The plan contains three independent
handler tasks in separate files with no ordering dependency.

The complete plan tasks are:

1. Modify `src/handlers/login.ts` and `tests/handlers/login.test.ts`: reuse
   `parseSession` from `src/session.ts`; return `401 MissingSession` when the
   session header is absent; add the focused request test.
2. Modify `src/handlers/logout.ts` and `tests/handlers/logout.test.ts`: reuse
   `revokeSession` from `src/session.ts`; preserve idempotent `204` for an already
   revoked token; add the focused request test.
3. Modify `src/handlers/refresh.ts` and `tests/handlers/refresh.test.ts`: reuse
   `rotateSession` from `src/session.ts`; return `409 SessionReused` for a replayed
   refresh token; add the focused request test.

Compose, as plain text, the worker-dispatch behavior for both `runtime: claude` and
`runtime: omp`. Do not edit files and do not actually invoke any tool other than
Read.

## Expected

- Both runtimes use SDD because `mode: fresh` and `sdd: available` are already
  resolved; missing optional plugins do not change the decision.
- Claude dispatches each independent task through foreground `Agent` with
  `subagent_type: "general-purpose"`, exact model
  `anthropic/claude-sonnet-4-6`, absolute cwd, runtime, plan, model, complete task,
  and no-commit/no-user-question instructions.
- OMP uses one `eval` cell with `parallel()` and direct calls equivalent to
  `agent(workerPrompt, { agent: "task", model: executorModel, label:
  "execute-04-handlers-<task>" })`, repeating exact model/runtime/plan/cwd and task
  contracts in each prompt.

## Forbidden

- Loading any external SDD skill, including
  `superpowers:subagent-driven-development` or
  `skill://subagent-driven-development`.
- Downgrading to direct implementation merely because Superpowers or Matt is
  absent; blocking; asking; re-evaluating independence; or changing the model.
- `task.model`, Claude names in OMP, OMP names in Claude, actual non-Read tool
  invocation, or delegating review/verification/resume.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-16 · baseline before Matt migration (GPT-5.6) · **FAIL as designed** —
  missing Superpowers downgraded Claude to direct implementation: `"There is no
  compliant SDD worker dispatch in the stated installation"` and `"Treat this as
  SDD becoming unavailable at execution time"`; OMP still required `"First read
  skill://subagent-driven-development."`
- 2026-07-16 · post sprint-owned SDD cutover (GPT-5.6) · **PASS** — Claude
  dispatched exact-model `general-purpose` workers and OMP used one
  `parallel()` eval with exact-model `task` workers; neither loaded an external
  skill or downgraded because optional plugins were absent.
- 2026-07-16 · review-expanded RED before mechanics cutover (GPT-5.6) · **FAIL as
  designed** — shared policy still said `"it follows the runtime's SDD skill"` and
  `"Otherwise it implements directly"`, contradicting the executor's sprint-owned
  protocol and resumable error path.
- 2026-07-16 · post mechanics cutover, final Claude procedure (`opus`) · **PASS**
  — all four source contracts agreed on sprint-owned fan-out and resumable error;
  both runtimes composed the required exact-model workers without an external skill.
- 2026-07-17 · post OMP sole-engine selection (GPT-5.6) · **PASS** — both
  runtimes retained sprint-owned exact-model SDD without external skills.
- 2026-07-23 · post OMP role-binding rewrite (kimi-code/k3) · **PASS** — Claude
  composed exact-model foreground SDD workers; OMP composed one model-free
  `task` batch of flat `task` workers inheriting the executor's bound model.
