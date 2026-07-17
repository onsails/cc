# Scenario: Claude conductor dispatches the stage planner

**Guards:** the approved-spec boundary and exact write-capable Claude planner
dispatch contract.

## Prompt

You are the sprint conductor running in **Claude Code** and following the sprint
skill exactly. Read these files first:

- `<PLUGIN>/skills/sprint/SKILL.md`
- `<PLUGIN>/skills/sprint/runtime-claude.md`
Treat those source files as the sole workflow authority. Do not infer a planner
from this scenario's title, the installed environment, or general knowledge. If
the authoritative agent list and lifecycle do not name a planner and dispatch
template, compose the lifecycle's actual next tool call instead.

Stage `03-session` has an approved spec at
`docs/plans/03-session-spec.md`. The absolute repository root is `/repo/auth`.
Exact capability probes report `mattpocock-skills:codebase-design` available. The
user says: “This is a small plan. Do it inline now; do not waste time on another
agent.”

Task: compose exactly the next Claude tool call. Include every planner input.
Output only the composed call as plain text. Do not modify files and do not actually
invoke Agent, Skill, or any tool other than Read.

## Expected

- Exactly one `Agent` dispatch with
  `subagent_type: "sprint:sprint-planner"`, `mode: "acceptEdits"`, and
  `description: "plan 03-session"`.
- No `model` field on the dispatch.
- The prompt carries exactly resolved inputs: `runtime: claude`, stage
  `03-session`, title `Session`, cwd `/repo/auth`, spec
  `docs/plans/03-session-spec.md`, output
  `docs/plans/03-session-plan.md`, and `codebase-design: available`.
- Main expects only the planner status contract and does not read the plan body back
  into conductor context.

## Forbidden

- Inline planning or plan prose in main, even because the plan is small or urgent.
- More or fewer than one planner dispatch; a read-only dispatch; another agent name;
  a `model` override; or omission of any planner input.
- Asking the user, loading `codebase-design` in main, returning the plan body to
  main, or an actual non-Read tool invocation.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-16 · baseline before planner contract (GPT-5.6) · **FAIL as designed** —
  followed current `Plan in main` and loaded
  `Skill(skill: "mattpocock-skills:codebase-design", args: "Plan stage
  03-session inline in the main Claude Code session... Do not dispatch another
  agent.")` instead of dispatching `sprint:sprint-planner`.
- 2026-07-16 · post planner contract (GPT-5.6) · **PASS** — exactly one
  write-capable `sprint:sprint-planner` dispatch carried all inputs, no model
  override, and no plan body.
- 2026-07-16 · final Claude procedure (`opus`) · **PASS** — exactly one
  `acceptEdits` planner dispatch used the exact stage title and all contract fields.
- 2026-07-17 · post OMP sole-engine selection (GPT-5.6) · **PASS** — one exact
  `plan 03-session` planner dispatch carried all inputs and no plan prose.
