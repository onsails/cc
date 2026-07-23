# Scenario: OMP role-bound task dispatch (Nesting: yes)

**Guards:** OMP-native dispatch is pure `task` with role-bound models. The
conductor sends one model-free `sprint-stage-runner` through `task`; the
stage-runner dispatches `sprint-stage-executor` and `sprint-reviewer` through
`task` again. No `eval`, no `agent()` bridge, no model value appears anywhere:
each agent's model is bound by its definition's frontmatter role
(`sprint-stage-executor` → `@task`, `sprint-reviewer` → `@slow`), and the
stage-runner inherits the conductor's model. The conductor never asks for,
pins, persists, or passes a model on OMP.

## Prompt

You are the sprint conductor running in **Oh My Pi (OMP)** and following the sprint
skill exactly. Read these files first with `read` (OMP has no Skill tool):

- `<PLUGIN>/skills/sprint/SKILL.md`
- `<PLUGIN>/skills/sprint/mechanics.md`
- `<PLUGIN>/agents/stage-runner.md`

The sprint has already been set up and persisted in `docs/plans/auth-sprint.md`:

```text
# Auth — Sprint
Runtime: omp
Integration: feat/auth  ·  Base: master
Engine: native
Nesting: yes
Review backend: reviewer
Legend: todo · brainstorming · planned · executing · review · blocked · done

## Stages
1. [planned] API — spec:01-api-spec.md plan:01-api-plan.md
```

Pre-dispatch for stage `01-api` is complete. Its plan is
`docs/plans/01-api-plan.md`, its title is `API`, its review effort is `xhigh`, and
native SDD is `available`. The absolute repository path is `/repo/auth`; the stage
worktree will be `/repo/auth/.worktrees/01-api`.

OMP runtime facts (host capabilities, not sprint policy):

- OMP sprint agent names are exact and flat: `sprint-stage-runner`,
  `sprint-stage-executor`, `sprint-reviewer`, `sprint-investigator`,
  `sprint-planner`. Plugin namespace names such as `sprint:sprint-stage-runner`
  are invalid.
- The `task` tool spawns subagents (single or `tasks[]` batch) and has **no model
  field**. A spawned agent runs at the model bound in its own agent definition;
  an agent definition without a model inherits its dispatcher's model.
- Nested spawning works: an agent whose definition declares `spawns` receives the
  `task` tool while `taskDepth < task.maxRecursionDepth`.
- OMP has no `Agent`, `AskUserQuestion`, or `Skill` tool. If an agent needs a
  skill, it loads it with `read skill://<name>`.

Task: compose, as plain text, the exact OMP calls for (1) the conductor's
dispatch of the whole stage, (2) the stage-runner's dispatch for native
execution, and (3) the stage-runner's dispatch for review.
Label the owner of each call explicitly so the two nested calls cannot be read as
direct conductor dispatches; ownership labels are part of the composed
configuration, not commentary.
Show the runtime recursion setting. Output ONLY the composed configuration and calls,
with no commentary. Do not modify files and do not actually invoke `task`, `eval`,
or any agent; `read` is the only tool you may call.

## Expected

- Runtime configuration sets `task.maxRecursionDepth` to at least `3`.
- The conductor uses one batch call for the whole stage:
  `task({ context: "<shared sprint background>", tasks: [{ name: "stage-01",
  agent: "sprint-stage-runner", task: "<all resolved stage inputs>" }] })`.
- The stage-runner assignment includes all resolved non-model inputs:
  `runtime: omp`, `engine: native`, sprint `auth`, stage `01-api`, title `API`,
  plan `docs/plans/01-api-plan.md`, review effort `xhigh`,
  `review-backend: reviewer`, `sdd: available`, and the repository/worktree paths.
- The stage-runner dispatches execution through `task` with flat agent
  `sprint-stage-executor`; the prompt carries `runtime: omp`, `mode: fresh`,
  absolute cwd `/repo/auth/.worktrees/01-api`, `sdd: available`, and the plan
  path.
- After execution, the stage-runner dispatches review through `task` with flat
  agent `sprint-reviewer`; the prompt carries the absolute worktree, stage
  `01-api`, plan path, review effort `xhigh`, and `review-backend: reviewer`
  verbatim.
- No model value appears in any call or prompt: executor and reviewer models come
  from their agent definitions, and neither the conductor nor the runner selects,
  asks, pins, translates, or passes one.

## Forbidden

- Any `eval` cell, `agent(...)` bridge call, or pseudo-call outside the `task`
  tool for executor, reviewer, or stage-runner dispatch.
- A model value, role alias, or `model` field anywhere: in a `task` call, in a
  prompt, in the sprint document, or as a question to the user.
- Asking the user to choose an executor or review model, or consulting a model
  catalog.
- Claude-only `Agent(...)` syntax; `subagent_type`; namespaced agent names such as
  `sprint:sprint-stage-runner`; or any `AskUserQuestion` or Skill-tool invocation.
- Dispatching `sprint-stage-executor` or `sprint-reviewer` directly from main,
  running either inline in the conductor, or skipping `sprint-stage-runner`
  despite `Nesting: yes`.
- Replacing any named sprint agent with a generic worker or another agent chosen
  by the composer.
- Configuring `task.maxRecursionDepth` below `3` for the nested review hierarchy.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-23 · rewrite for role-bound pure-task dispatch (contract change) · the
  previous revision guarded exact-model `eval agent()` dispatch; the OMP model
  machinery (ASK, pins, repin, floor) was removed in favor of frontmatter role
  binding (`@task`/`@slow`) and pure `task` dispatch. Prior log entries retired
  with the old contract: 2026-07-11 baseline FAIL as designed; 2026-07-11
  post-OMP adapter PASS; 2026-07-12 post-repin PASS; 2026-07-16/17/21 PASS.
- 2026-07-23 · baseline against pre-rewrite skill (prompt-only run, kimi-code/k3)
  · **RED as designed** — the conductor followed the old adapter: `task` only for
  the stage-runner with `review-model: anthropic/claude-opus-4-6` and `model:
  anthropic/claude-sonnet-4-6` inside the assignment, then `eval` cells calling
  `agent(executorPrompt, { agent: "sprint-stage-executor", model:
  "anthropic/claude-sonnet-4-6" })` and `agent(reviewPrompt, { agent:
  "sprint-reviewer", model: "anthropic/claude-opus-4-6" })`.
- 2026-07-23 · post role-binding rewrite (kimi-code/k3) · **PASS** — one
  model-free `task` batch dispatched flat `sprint-stage-runner` with every
  resolved non-model input; the runner-owned `task` calls dispatched flat
  `sprint-stage-executor` (`mode: fresh`, worktree cwd, `sdd: available`, plan)
  and flat `sprint-reviewer` (worktree, stage, plan, `xhigh`, `review-backend:
  reviewer`); no `eval`, no `agent()` bridge, no model anywhere.
