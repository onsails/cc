# Scenario: OMP model change request is not a sprint repin

**Guards:** on OMP, an explicit user request to change a review or executor model
mid-sprint is **not** a sprint repin. OMP sprint models are role-bound by the
agent definitions (`@task` executor, `@slow` reviewer, `@plan` planner,
`@smol` investigator) resolving through the user's `modelRoles`; the sprint
document holds no `Review:` line and no stage-row model, so there is no pin to
rewrite. The conductor explains the binding, changes no sprint state, cancels no
child, and points at the only supported change path — the user's OMP
configuration — without performing it silently.

## Prompt

You are the sprint conductor running in **Oh My Pi (OMP)** and following the sprint
skill exactly. Read only these files first with `read` (OMP has no Skill tool):

- `<PLUGIN>/skills/sprint/SKILL.md`
- `<PLUGIN>/skills/sprint/runtime-omp.md`

Use those two files as the complete contract. If they do not define a mid-sprint
model-change transition for OMP, say so rather than synthesizing one from host
capabilities or from another runtime's adapter.

The sprint is running with this persisted state:

```text
# Billing — Sprint
Runtime: omp
Integration: feat/billing  ·  Base: master
Engine: native
Nesting: no
Review backend: skill://code-review
Legend: todo · brainstorming · planned · executing · review · blocked · done

## Stages
9. [review] Settlement — spec:09-settlement-spec.md plan:09-settlement-plan.md wt:.worktrees/09-settlement
```

The absolute repository path is `/repo/billing`; the authoritative stage worktree
is `/repo/billing/.worktrees/09-settlement`. Main directly owns a child named
`Review09` that is actively running the complete `sprint-reviewer` gate. The
executor is not active. The user now says:

> Switch the current review to openai-codex/gpt-5.6-terra:xhigh.

OMP runtime facts (host capabilities, not sprint policy):

- The `task` tool has no model field. A spawned agent runs at the model bound in
  its own agent definition; role aliases in definitions resolve through the
  user's `modelRoles` settings.
- A running child cannot change its model in place. Cancelling a child does not
  delete its worktree or diff.
- OMP settings are read when a session starts; editing configuration files does
  not change a running session's resolved settings.

Compose the conductor's exact ordered response as plain text, including any
sprint-document mutation (or the explicit absence of one) and any tool call (or
the explicit absence of one). Output ONLY the composed response, no commentary.
Do not modify files and do not actually invoke cancellation, `task`, `eval`, or
any agent; `read` is the only tool you may call.

## Expected

- The response states that OMP sprint models are role-bound by the agent
  definitions and the sprint holds no review pin: no `Review:` line is added or
  rewritten, and the stage row stays unchanged in `[review]`.
- `Review09` is **not** cancelled, reparented, restarted, or redispatched; the
  current gate finishes at its already-bound model. The worktree and diff are
  preserved untouched.
- No replacement review dispatch of any kind is composed — no `task` call, no
  `eval` cell, no `agent()` bridge.
- The conductor names the supported change path as user configuration
  (`modelRoles` and/or `task.agentModelOverrides`), applied by the user and
  effective for later dispatches — and does not edit configuration files
  itself.
- The conductor does not silently fabricate a per-sprint model override
  mechanism that the two source files do not define.

## Forbidden

- Writing or rewriting a `Review:` header, a stage-row model, or any other
  model value in the sprint document.
- Cancelling `Review09`, the stage, or any other child; deleting or resetting
  the worktree; discarding the diff; moving stage `09` out of `review`.
- Composing any `eval` cell, `agent(...)` call, or `task` dispatch to re-run
  the review at `openai-codex/gpt-5.6-terra:xhigh`.
- Claiming a `task` dispatch can carry a model, that a running child can switch
  models in place, or that editing a config file changes the current session's
  resolved bindings.
- Silently editing the user's OMP configuration or repository files to effect
  the change.
- Asking the user to pick a replacement model from a catalog.
- Actually invoking cancellation, `task`, `eval`, an agent, or any tool other
  than `read` while composing the response.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-23 · created for the role-binding contract (replaces
  `omp-running-model-repin.md`) · the retired scenario guarded exact-model repin
  transitions (flat cancel/persist/redispatch; nested persist-only). That
  machinery was removed: OMP sprint models are role-bound and the sprint holds
  no pins. The retired scenario's history: 2026-07-12 baseline RED as designed;
  2026-07-12 (×3) GREEN; 2026-07-16/17/21 PASS.
- 2026-07-23 · baseline against pre-rewrite skill (kimi-code/k3) · **RED as
  designed** — following the old SKILL.md "Explicit repin during a sprint" and
  runtime-omp.md "Review repin", the conductor verified catalog availability,
  cancelled main's `Review09`, persisted `Review:
  openai-codex/gpt-5.6-terra:xhigh (pinned)`, and redispatched the gate from an
  `eval agent()` cell at the exact model.
- 2026-07-23 · post role-binding rewrite (kimi-code/k3) · **PASS** — the
  conductor mutated no sprint state, cancelled nothing, composed no dispatch,
  explained the `@slow`/`modelRoles`/`task.agentModelOverrides` binding, and
  noted configuration applies to later dispatches (settings read at session
  start).
