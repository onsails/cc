# Scenario: OMP native fixed-model dispatch (Nesting: yes)

**Guards:** OMP-native model selection, persistence, and nested dispatch. The
conductor must send one fixed-model, flat-named `sprint-stage-runner` through
`task`, whose schema has no `model` field. The stage-runner must preserve both
user-selected models through OMP's model-aware `eval` bridge and
`agent(prompt, { agent, model })` API.

## Prompt

You are the sprint conductor running in **Oh My Pi (OMP)** and following the sprint
skill exactly. Read these files first with `read` (OMP has no Skill tool):

- `<PLUGIN>/skills/sprint/SKILL.md`
- `<PLUGIN>/skills/sprint/mechanics.md`
- `<PLUGIN>/agents/stage-runner.md`

The user explicitly selected executor model `anthropic/claude-sonnet-4-6` and
review model `anthropic/claude-opus-4-6` through OMP's `ask`. The selections have
already been persisted in `docs/plans/auth-sprint.md`:

```text
# Auth — Sprint
Runtime: omp
Integration: feat/auth  ·  Base: master
Engine: native (model: anthropic/claude-sonnet-4-6, pinned)
Nesting: yes
Review: anthropic/claude-opus-4-6 (pinned)
Legend: todo · brainstorming · planned · executing · review · blocked · done

## Stages
1. [planned] API — spec:01-api-spec.md plan:01-api-plan.md
   model:anthropic/claude-sonnet-4-6
```

Pre-dispatch for stage `01-api` is complete. Its plan is
`docs/plans/01-api-plan.md`, its title is `API`, its review effort is `xhigh`, and
native SDD is `available`. The absolute repository path is `/repo/auth`; the stage
worktree will be `/repo/auth/.worktrees/01-api`. The executor must run at the pinned
`anthropic/claude-sonnet-4-6` model. The review gate must run at the pinned
`anthropic/claude-opus-4-6` model; no component may inherit, choose, translate,
downgrade, or replace either model.

OMP runtime facts:

- OMP sprint agent names are exact and flat: `sprint-stage-runner`,
  `sprint-stage-executor`, `sprint-reviewer`, and `sprint-investigator`. Plugin
  namespace names such as `sprint:sprint-stage-runner` are invalid.
- `task` dispatches the stage-runner whose own model is fixed by its agent
  definition. The `task` schema has no per-call `model` field; this is a structural
  restriction, not inheritance semantics. Use the batch shape `task({ agent:
  "sprint-stage-runner", tasks: [{ id, assignment }], context })` and put the
  resolved executor and review models in the assignment.
- Each model-specific nested dispatch is an `eval` tool call containing a
  JavaScript or Python cell that invokes
  `agent(prompt, { agent: "<flat-name>", model: "<model>" })`.
- OMP has no `Agent`, `AskUserQuestion`, or `Skill` tool. If an agent needs a skill,
  it loads it with `read skill://<name>`.
- Do not substitute a Pi role, a generic worker, or an inline conductor for a named
  sprint agent.
- Nested review uses `main → sprint-stage-runner → sprint-reviewer → workers`, so
  runtime configuration must set `task.maxRecursionDepth >= 3`.

Task: compose, as plain text, the exact OMP calls for (1) the conductor's `task`
dispatch to `sprint-stage-runner`, including its full resolved assignment, (2) the
stage-runner's `eval` call for native execution, and (3) the stage-runner's `eval`
call for review.
Show the runtime recursion setting. Output ONLY the composed configuration and calls,
with no commentary. Do not modify files and do not actually invoke `task`, `eval`, or
any agent; `read` is the only tool you may call.

## Expected

- Runtime configuration sets `task.maxRecursionDepth` to at least `3`.
- The conductor uses this call shape for the whole stage:
  `task({ agent: "sprint-stage-runner", tasks: [{ id: "stage-01", assignment:
  "<all resolved stage inputs>" }], context: "<shared sprint background>" })`.
  The `task` call contains **no `model` field anywhere**.
- The stage-runner prompt includes all resolved inputs: `runtime: omp`, `engine:
  native`, sprint `auth`, stage `01-api`, title `API`, plan
  `docs/plans/01-api-plan.md`, review effort `xhigh`, `sdd: available`, executor
  model `anthropic/claude-sonnet-4-6`, review model
  `anthropic/claude-opus-4-6`, and the repository/worktree context needed to run the
  stage.
- The stage-runner dispatches execution from an `eval` JavaScript or Python cell
  with the semantic equivalent of `await agent(executorPrompt, { agent:
  "sprint-stage-executor", model: "anthropic/claude-sonnet-4-6", label:
  "execute-01-api" })`. A bare pseudo-call outside `eval` is insufficient. The
  executor prompt carries `mode: fresh`, absolute cwd
  `/repo/auth/.worktrees/01-api`, `sdd: available`, and the plan path or full plan.
- After execution, the stage-runner dispatches review from another `eval` cell with
  the semantic equivalent of `await agent(reviewPrompt, { agent:
  "sprint-reviewer", model: "anthropic/claude-opus-4-6", label:
  "review-01-api" })`. The review prompt carries the absolute worktree, stage
  `01-api`, and review effort `xhigh`.
- The calls use the persisted values verbatim. Neither nested dispatch relies on
  session inheritance or runtime defaults for its model.

## Forbidden

- A `model` field anywhere on `task`, including attempts to run the stage-runner
  itself at either selected model through a nonexistent per-call option.
- Claude-only `Agent(...)` syntax; `subagent_type`; namespaced agent names such as
  `sprint:sprint-stage-runner`, `sprint:sprint-stage-executor`, or
  `sprint:sprint-reviewer`; or any `AskUserQuestion` or Skill-tool invocation.
- Dispatching `sprint-stage-executor` or `sprint-reviewer` directly from main,
  running either inline in the conductor, or skipping `sprint-stage-runner` despite
  `Nesting: yes`.
- Replacing any named sprint agent with a Pi role, `general-purpose`, a generic
  worker, or another agent chosen by the composer.
- Omitting either model from the stage-runner assignment; omitting `model:
  "anthropic/claude-sonnet-4-6"` from the executor's `agent` options; or omitting
  `model: "anthropic/claude-opus-4-6"` from the reviewer's `agent` options.
- Silent inheritance, fallback, alias translation, model selection by a nested
  agent, or downgrading either persisted model.
- Loading a skill through anything except `read skill://<name>`, or configuring
  `task.maxRecursionDepth` below `3` for the nested review hierarchy.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-11 · baseline (pre-OMP model dispatch) · **FAIL as designed** — current
  mechanics.md has no `Runtime: omp` path and prescribes Claude-only
  `Agent(subagent_type: "sprint:stage-runner")`, followed by nested
  `Agent(subagent_type: "sprint:stage-executor", model: <same model>)` and
  `Agent(subagent_type: "general-purpose", model: <review model>)` calls. OMP cannot
  execute `Agent` or namespaced `subagent_type` calls; its `task` API cannot accept a
  per-call model, and current mechanics never requires the stage-runner to use
  `eval` and call `agent(..., { agent: "sprint-stage-executor", model:
  "anthropic/claude-sonnet-4-6" })` and `agent(..., { agent:
  "sprint-reviewer", model: "anthropic/claude-opus-4-6" })`. Therefore the
  persisted executor and review selections cannot be dispatched through the current
  OMP mechanics without invalid Claude syntax or a silent model fallback.
- 2026-07-11 · post-OMP runtime adapter (GPT-5.6) · **PASS** — configured
  `task.maxRecursionDepth: 3`; dispatched flat `sprint-stage-runner` through a
  model-free `task` call containing every resolved stage input; then used separate
  `eval` cells for flat `sprint-stage-executor` and `sprint-reviewer`, each with the
  persisted exact model in both its prompt and `agent()` options.
- 2026-07-12 · post-model repin skill changes (fresh OMP rerun) · **PASS** — set
  `task.maxRecursionDepth = 3`; dispatched flat `sprint-stage-runner` with exact
  task id `stage-01`, every resolved stage input, and no task `model` field; then
  composed separate JavaScript `eval` cells for flat `sprint-stage-executor` at
  `anthropic/claude-sonnet-4-6` and `sprint-reviewer` at
  `anthropic/claude-opus-4-6`, preserving both pinned models verbatim.

