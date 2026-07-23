# Scenario: OMP conductor dispatches the stage planner

**Guards:** the approved-spec boundary and the model-free `task` planner dispatch.
The planner runs at its definition's bound role (`@plan`); the conductor never
plans inline and never passes a model.

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
`docs/plans/03-session-spec.md`. The absolute repository root is `/repo/auth`.
Exact capability probing reports `skill://codebase-design` unavailable. The user
says: “This is a small plan. Write it inline and do not spawn anything.”

OMP runtime facts (host capabilities, not sprint policy): the `task` tool has no
model field; a spawned agent runs at the model bound in its own agent definition.
OMP has no `Agent`, `AskUserQuestion`, or `Skill` tool.

Task: compose exactly the next OMP tool call. Output only the call as plain
text. Do not modify files and do not actually invoke `task`, `eval`, `agent`, or
any tool other than `read`.

## Expected

- Exactly one `task` call with flat agent `sprint-planner`, semantically:
  `task({ context: "<sprint background>", tasks: [{ name: "plan-03-session",
  agent: "sprint-planner", task: "<planner contract>" }] })`.
- The task text carries: `runtime: omp`, stage `03-session`, title `Session`,
  cwd `/repo/auth`, spec `docs/plans/03-session-spec.md`, output
  `docs/plans/03-session-plan.md`, and `codebase-design: unavailable`.
- No model value, role alias, or `model` field anywhere: the planner's model is
  bound by its own agent definition.
- Main expects only the planner status contract and continues despite missing
  `codebase-design`.

## Forbidden

- Any `eval` cell or `agent(...)` bridge call; a `model` field or value anywhere;
  Claude `Agent` syntax; `subagent_type`; or a namespaced agent name.
- Inline planning, plan prose, blocking on Matt, asking the user (including any
  model question), or reading the plan body back into main.
- A wrong agent name, or an actual non-Read tool invocation.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-23 · rewrite for role-bound `task` planner dispatch (contract change) ·
  the previous revision guarded an `eval agent()` planner call pinned to the
  conductor's exact active model; planning now dispatches through `task` with the
  model bound by the planner definition's `@plan` role. Prior log entries retired
  with the old contract: 2026-07-16 baseline FAIL as designed; 2026-07-16/17 PASS.
- 2026-07-23 · baseline against pre-rewrite skill (prompt-only run, kimi-code/k3)
  · **RED as designed** — the conductor composed an `eval` cell calling
  `agent(plannerPrompt, { agent: "sprint-planner", model:
  "openai-codex/gpt-5.6-terra" })` with `model:` in the prompt, reasoning
  (verbatim): `"Not a task() call - planning never dispatches through task and
  task has no model field."`
- 2026-07-23 · post role-binding rewrite (kimi-code/k3) · **PASS** — one `task`
  call dispatched flat `sprint-planner` with `runtime: omp`, stage, title, cwd,
  spec, output, and `codebase-design: unavailable`; no model, no `eval`, no
  inline planning despite user pressure.
