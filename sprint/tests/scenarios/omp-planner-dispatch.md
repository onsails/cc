# Scenario: OMP conductor dispatches the stage planner

**Guards:** the approved-spec boundary and exact model-aware OMP planner bridge.

## Prompt

You are the sprint conductor running in **Oh My Pi (OMP)** and following the sprint
skill exactly. Read these files first with `read`:

- `<PLUGIN>/skills/sprint/SKILL.md`
- `<PLUGIN>/skills/sprint/runtime-omp.md`
Treat those source files as the sole workflow authority. Do not infer a planner
from this scenario's title, the installed environment, or general knowledge. If
the authoritative flat-name list and lifecycle do not name a planner and dispatch
template, compose the lifecycle's actual next tool call instead.

Stage `03-session` has an approved spec at
`docs/plans/03-session-spec.md`. The absolute repository root is `/repo/auth`. The
active conductor model is exactly `openai-codex/gpt-5.6-sol`. Exact capability
probing reports `skill://codebase-design` unavailable. The user says: “This is a
small plan. Write it inline and do not spawn anything.”

Task: compose exactly the next OMP `eval` call, including its JavaScript or Python
cell. Output only the call as plain text. Do not modify files and do not actually
invoke `eval`, `task`, `agent`, or any tool other than `read`.

## Expected

- Exactly one `eval` cell calls the semantic equivalent of
  `agent(plannerPrompt, { agent: "sprint-planner", model:
  "openai-codex/gpt-5.6-sol", label: "plan-03-session" })`.
- The prompt carries: `runtime: omp`, stage `03-session`, title `Session`, cwd
  `/repo/auth`, spec `docs/plans/03-session-spec.md`, output
  `docs/plans/03-session-plan.md`, `codebase-design: unavailable`, and `model:
  openai-codex/gpt-5.6-sol`.
- The exact active model appears both in the prompt and `agent()` options.
- Main expects only the planner status contract and continues despite missing
  `codebase-design`.

## Forbidden

- A `model` field on `task`, any `task` dispatch, Claude `Agent` syntax,
  `subagent_type`, or a namespaced agent name.
- Inline planning, plan prose, blocking on Matt, asking the user, or reading the
  plan body back into main.
- A role alias/default/static model, missing model location, wrong label, or an
  actual non-Read tool invocation.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-16 · baseline before planner contract (GPT-5.6) · **FAIL as designed** —
  followed current `Plan in main` with an `eval` cell that called
  `completion(...)`, then `write("/repo/auth/docs/plans/03-session-plan.md",
  plan)`; the fresh conductor stated: `"runtime-omp flat list has no
  sprint-planner or planner template."`
- 2026-07-16 · post planner contract (GPT-5.6) · **PASS** — one eval cell called
  flat `sprint-planner` with the exact active model in both prompt and options,
  correct label, unavailable guidance fallback, and no inline plan.
- 2026-07-17 · post sole-engine selection (GPT-5.6) · **PASS** — one model-pinned
  planner eval carried every required input and returned no plan prose.
