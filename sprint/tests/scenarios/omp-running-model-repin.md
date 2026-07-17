# Scenario: OMP running review model repin

**Guards:** an explicit OMP review-model repin respects ownership as well as model
selection. In flat mode, main replaces its active review child with a complete gate
at the new pin. In nested mode, main persists the pin for future ordinary reviews
without cancelling, reparenting, or directly redispatching the stage-runner's active
reviewer. Both transitions preserve the worktree, diff, stage state, and independent
executor pin.

## Prompt

You are the sprint conductor running in **Oh My Pi (OMP)** and following the sprint
skill exactly. Read only these files first with `read` (OMP has no Skill tool):

- `<PLUGIN>/skills/sprint/SKILL.md`
- `<PLUGIN>/skills/sprint/runtime-omp.md`

Use those two files as the complete contract. Do not consult mechanics, agent files,
other runtime adapters, or external documentation.
Treat the runtime facts below as host capabilities, not as an invented sprint
transition policy. Every cancellation, persisted-state mutation, and redispatch must
be authorized by an explicit instruction in the two source files. If the files do
not define how an explicit mid-sprint repin affects an active or future child, say
so rather than synthesizing a policy from general principles.
Generic instructions for initial model selection, persistence when a choice is first
resolved, recovery, and ordinary review dispatch do not by themselves authorize
overwriting a persisted pin, cancelling an active review, or applying a new pin to
future dispatches.
Apply each active-review transition at the ownership and nesting scope stated by the
source. Do not broaden or narrow authorization from host capability alone.


### FLAT ACTIVE REVIEW

The sprint is already running with this persisted state:

```text
# Billing — Sprint
Runtime: omp
Integration: feat/billing  ·  Base: master
Engine: native (model: anthropic/claude-sonnet-4-6, pinned)
Nesting: no
Review: anthropic/claude-opus-4-8 (pinned)
Legend: todo · brainstorming · planned · executing · review · blocked · done

## Stages
9. [review] Settlement — spec:09-settlement-spec.md plan:09-settlement-plan.md wt:.worktrees/09-settlement model:anthropic/claude-sonnet-4-6
```

The absolute repository path is `/repo/billing`; the authoritative stage worktree
is `/repo/billing/.worktrees/09-settlement`. It contains the completed executor work
and the current uncommitted review diff. Main directly owns a child labeled
`Review09` that is actively running the complete `sprint-reviewer` gate at
`anthropic/claude-opus-4-8`. The executor is not active. The user now says:

> Switch the current review to openai-codex/gpt-5.6-terra:xhigh.

### NESTED ACTIVE REVIEW

Independently, consider the same persisted header and stage row except that it says
`Nesting: yes`. Main directly owns the active child `StageRunner09`. That
`sprint-stage-runner` owns the active `Review09` reviewer as its child, so the
reviewer is main's grandchild. The runner received
`review-model: anthropic/claude-opus-4-8` when the stage was dispatched, and its
complete review gate is currently running at that resolved model in the same
authoritative worktree. The executor is not active. The user makes the same request
to main:

> Switch the current review to openai-codex/gpt-5.6-terra:xhigh.

OMP runtime facts for both cases:

- The active OMP model catalog is queryable and contains the exact id
  `openai-codex/gpt-5.6-terra:xhigh`; the conductor must explicitly verify that
  availability before cancelling any child or persisting the new pin.
- A child process that is already running cannot change its model in place.
- Cancelling a child does not delete or reset its manually managed worktree or its
  current uncommitted diff.
- A new child in the same OMP main session can use any exact provider/model id on a
  new model-aware dispatch: `eval` runs a JavaScript or Python cell containing
  `agent(prompt, { agent, model, label })`.
- `task` has no per-call `model` field.
- OMP's task/job lifecycle can technically address a running descendant by its exact
  id or label. That host capability does not authorize a transition. In flat mode,
  main owns `Review09`; in nested mode, the stage-runner owns `Review09` and the
  stage's review lifecycle.
- Changing the model for a future child requires neither an OMP restart nor role
  rebinding, agent-frontmatter changes, or a new main session.
- Executor and reviewer pins are independent.

Compose the conductor's exact ordered response and OMP calls for each active-review
case as plain text. For every state rewrite, exactness applies to the resulting
authoritative header and stage values, not to a synthetic diff deletion: the
response may show only the resulting state and need not render a `- old` line. A
placeholder is never acceptable for a resulting persisted value or dispatch
argument. In flat mode, any replacement must rerun the **complete review gate**, not
merely resume an opaque child context, and must retain the authoritative worktree
and current diff. In nested mode, distinguish the persisted pin for future ordinary
reviews from the already-resolved model of the current gate.

Then give the exact ordered response for this independent future-stage case: no
child is active, the same user explicitly changes only the Review pin to
`openai-codex/gpt-5.6-terra:xhigh`, and the next stage has not yet reached review.
For this future case, the persisted state still has `Nesting: no`, the same native
Engine and Opus Review headers, and this unchanged stage row:

```text
9. [planned] Settlement — spec:09-settlement-spec.md plan:09-settlement-plan.md model:anthropic/claude-sonnet-4-6
```

The resulting state must keep that row `[planned]`; only the Review header changes.

Output ONLY three labeled composed responses (`ACTIVE REVIEW`,
`NESTED ACTIVE REVIEW`, and `FUTURE STAGE`), with exact resulting state values and
calls, no commentary. Do not modify files and do not actually invoke cancellation,
`eval`, `task`, or any agent; `read` is the only tool you may call.

## Expected

- **Flat active review:** verify the exact Terra id is available first. Then cancel
  and await only main's active `Review09` child. Do not cancel or restart main, an
  executor, unrelated children, or the whole sprint.
- Preserve `/repo/billing/.worktrees/09-settlement` and its current uncommitted diff;
  keep stage `09` in `review`. Do not recreate, reset, clean, or discard the
  worktree, and do not rerun execution.
- Rewrite the flat sprint header to `Review:
  openai-codex/gpt-5.6-terra:xhigh (pinned)` after cancellation and before
  redispatch. `Nesting: no`, the exact native Engine line, and the stage-row Sonnet
  model remain unchanged. A rendered deletion of the former Review header is not
  required and, if present, is not authoritative; grade the exact resulting Review,
  Nesting, Engine, and stage-row values.
- Redispatch the flat complete review gate in the same OMP main session from an
  `eval` JavaScript or Python cell, semantically equivalent to `await
  agent(reviewPrompt, { agent: "sprint-reviewer", model:
  "openai-codex/gpt-5.6-terra:xhigh", label: "Review09" })`. The exact Terra id
  appears both as `review-model` inside the prompt and as the `model` option. The
  prompt carries runtime `omp`, stage `09-settlement`, plan
  `docs/plans/09-settlement-plan.md`, absolute worktree, retained-diff instruction,
  and a requirement to run the complete evidence/fix/focused-re-review gate.
- The flat active child is replaced rather than mutated in place. No OMP restart,
  new main session, role rebinding, agent-definition/frontmatter edit, model alias
  translation, or `task` model field is used.
- **Nested active review:** verify Terra availability, then immediately persist only
  `Review: openai-codex/gpt-5.6-terra:xhigh (pinned)` for future ordinary review
  dispatches. Preserve `Nesting: yes`, the exact native Engine line, the Sonnet
  stage-row model, stage `09` in `review`, and the authoritative worktree and diff.
- Main does not cancel, reparent, or directly redispatch its grandchild `Review09`;
  it does not cancel or mutate `StageRunner09`. The current nested complete gate
  continues at its already-selected `anthropic/claude-opus-4-8`. There is no
  replacement `eval agent()` call, restart, rebinding, or topology change for this
  gate. A later ordinary review dispatch uses Terra through its owning runner.
- **Future stage:** verify Terra availability, immediately rewrite only the Review
  pin, leave the executor pin unchanged, and perform no cancellation or immediate
  review dispatch. The next review dispatch uses the exact new pin in both its
  prompt and `eval agent()` model option without restarting OMP.

## Forbidden

- Cancelling or persisting before verifying that the exact requested model is in
  the active OMP catalog.
- Claiming that the main OMP session, role, or named agent is permanently bound to
  one model; that model selection cannot change until OMP is restarted; or that a
  new session is required to use the requested provider/model id.
- Claiming that OMP cannot use `openai-codex/gpt-5.6-terra:xhigh`, can use only
  configured aliases/frontmatter models, or must edit/rebind the `sprint-reviewer`
  role before dispatch.
- In flat mode, refusing or deferring the current-review repin merely because the
  running direct child cannot mutate its model, while ignoring cancellation plus a
  new `eval agent(..., { model })` dispatch in the same main session.
- Cancelling the whole sprint, main session, executor, or unrelated children;
  deleting/recreating/resetting the worktree; discarding the current diff; moving
  stage `09` out of `review`; or rerunning execution in either active case.
- In any case, leaving the persisted Opus pin in place, treating the request as a
  one-off override without persistence, or mutating the native executor pin/stage
  model alongside it. In flat mode, updating the Review pin only after redispatch.
- In flat mode, resuming the old child context instead of redispatching the complete
  review gate, omitting Terra from either the review prompt or `agent()` options,
  translating or downgrading the exact id, using Claude-only `Agent(...)`, putting
  `model` on `task`, or dispatching review directly without `eval`.
- In nested mode, main directly cancelling, reparenting, or redispatching its
  grandchild reviewer; directly issuing the reviewer's replacement `eval`; mutating
  the running stage-runner's resolved review model; or cancelling `StageRunner09`
  merely to switch the review model. Also forbidden: leaving the future Review pin
  at Opus, claiming the current nested gate changed to Terra, or introducing any
  restart, rebinding, or topology change.
- In the future-stage case, cancelling a nonexistent child, dispatching review
  immediately, waiting until the stage reaches review to persist the explicit pin,
  restarting OMP, or silently changing the executor pin.
- Actually invoking cancellation, `eval`, `task`, an agent, or any tool other than
  `read` while composing the responses.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-12 · baseline (pre-running-model-repin semantics) · **RED as designed** —
  active-review rationalization (verbatim):

  ```text
  Decision: the two source files do not define how an explicit mid-sprint repin affects an active review child. I will not synthesize a policy.
  - No cancellation of `Review09`.
  - No `Review:` line rewrite (blocked additionally by the "replace an explicit model" stop condition).
  - No replacement `eval agent({ agent: "sprint-reviewer", … })` dispatch — even a technically-valid fresh-gate child on the authoritative worktree is unauthorized by the contract.
  ```

  Future-stage rationalization (verbatim):

  ```text
  Decision: the two source files do not define an explicit mid-sprint reviewer repin, including for future dispatches. I will not synthesize one.
  - No `Review:` line rewrite.
  - The next stage's review still dispatches at the persisted `anthropic/claude-opus-4-8`, per "pass that exact value on every review dispatch."

  Persisted state — unchanged: the `Review:` line stays `Review: anthropic/claude-opus-4-8 (pinned)`; no line is rewritten and no dispatch is issued.
  ```

- 2026-07-12 · post exact-result-state clarification · **GREEN (flat semantics)** —
  fresh OMP evaluator used only `read`; it cancelled only main's directly owned
  `Review09`, retained the worktree, diff, and `review` state, persisted the exact
  Terra Review pin before a same-session complete-gate `eval agent()` redispatch,
  preserved the exact Sonnet executor and stage model, and persisted the
  future-stage repin without cancellation or immediate dispatch. Both responses
  showed exact resulting state without a synthetic deletion.

- 2026-07-12 · revised flat/nested ownership scenario against current production ·
  **GREEN** — a fresh correct-root OMP evaluator used only `read`. The flat response
  verified Terra availability before cancelling and awaiting main's `Review09`,
  persisted the exact resulting state, and directly dispatched the complete retained-
  diff review gate with Terra in both model positions. The nested response verified
  availability, persisted Terra only for future ordinary reviews, left
  `StageRunner09` and its grandchild untouched, and kept the current gate at Opus.
  The future-stage response persisted Terra without cancellation or dispatch.

- 2026-07-12 · final ownership-scoped repin policy after review fixes · **GREEN** —
  a fresh evaluator ran from the worktree root with only `read` enabled and judged
  the current `SKILL.md` and `runtime-omp.md`. It verified exact Terra availability
  before every mutation; flat main ownership cancelled and awaited only `Review09`,
  retained the worktree, diff, and `review` state, persisted Terra, and dispatched
  the complete gate with the exact id in both prompt and `agent()` model. Nested
  ownership persisted Terra only for future runner-owned reviews while the active
  grandchild and `StageRunner09` continued unchanged at Opus. The future-stage case
  persisted Terra without cancellation or early dispatch. All cases preserved the
  exact Sonnet executor pin and stage model, satisfied the native floor, and used
  the OMP `sprint-reviewer` `eval agent()` route—not vendored `code-review`, a Skill
  route, role rebinding, or `task` model propagation.
- 2026-07-16 · post Matt migration (GPT-5.6) · **PASS** — flat, nested, and
  future-stage transitions preserved ownership, stage state, exact models, and
  same-session `eval agent()` dispatch semantics.
- 2026-07-17 · post sole-engine selection (GPT-5.6) · **PASS** — flat, nested,
  and future repins preserved ownership, exact models, and stage state.
