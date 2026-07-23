# Scenario: OMP nested multi-agent review gate

**Guards:** the OMP review architecture for a nested sprint stage. The review gate
preserves the hierarchy `main → sprint-stage-runner → sprint-reviewer →
review/fixer workers`, loads the persisted review backend instead of maintaining
its own methodology, dispatches every worker through the `task` tool (a `tasks[]`
batch for the parallel fan-out), and keeps all review evidence and repair work
outside the conductor and stage-runner contexts. No model value appears anywhere:
review workers are the bundled read-only `reviewer` agent (bound to `@slow` by
its own definition), the fixer is the write-capable `task` agent inheriting the
sprint-reviewer's model, and the sprint-reviewer itself is bound to `@slow`.

## Prompt

You are the sprint conductor running in **Oh My Pi (OMP)** and following the sprint
skill exactly. Read these files first with `read` (OMP has no Skill tool):

- `<PLUGIN>/skills/sprint/SKILL.md`
- `<PLUGIN>/skills/sprint/mechanics.md`
- `<PLUGIN>/agents/stage-runner.md`
- `<PLUGIN>/agents/sprint-reviewer.md`

The sprint doc says:

```text
Engine: native
Nesting: yes
Review backend: skill://code-review
```

Execution for stage `02-api` has completed in the worktree. The uncommitted diff
changes authentication policy, request parsing, and tests, so beyond the backend's
own axes the review must cover the security and test-quality risk briefs. The stage
may not land until review and focused re-review are clean.

OMP runtime facts (host capabilities, not sprint policy):

- OMP sprint agent names are exact and flat: `sprint-stage-runner`,
  `sprint-stage-executor`, `sprint-reviewer`, `sprint-investigator`,
  `sprint-planner`. Plugin namespace syntax such as `sprint:sprint-stage-runner`
  is invalid.
- The `task` tool runs one subagent or a parallel `tasks[]` batch per call and
  has **no model field**. A spawned agent runs at the model bound in its own
  agent definition; the bundled `reviewer` agent is read-only and bound to
  `@slow`; the bundled `task` agent is write-capable and, having no model in its
  definition, inherits its dispatcher's model.
- Nested spawning works while `taskDepth < task.maxRecursionDepth`:
  main dispatches `sprint-stage-runner`, the runner dispatches
  `sprint-reviewer`, and the reviewer dispatches its workers — so the runtime
  needs `task.maxRecursionDepth >= 3`.
- OMP has no Skill tool. Skills are loaded with `read skill://<name>` when needed.

Task: compose the exact OMP dispatch plan and tool calls, as plain text, from the
main conductor's stage dispatch through the complete review gate. Include the agent
names, how the persisted review backend is loaded and bound, the parallel
backend-axis and risk-specialist review, evidence-only synthesis, fixing, focused
re-review, the retry cap, the reviewer's final `clean`/`blocked` result returned
to the stage-runner, and the runner's final `landed`/`blocked` result returned to
the conductor. Output ONLY the composed plan and calls, no commentary. Do not
modify files and do not actually invoke `task`, `eval`, or any agent; `read` is
the only tool you may call.

## Expected

- The configured hierarchy is explicit: `main → sprint-stage-runner →
  sprint-reviewer →` parallel flat-named review workers and a flat-named fixer.
  The runtime sets `task.maxRecursionDepth` to at least `3`.
- Main dispatches flat agent `sprint-stage-runner` through `task`. The
  stage-runner dispatches flat agent `sprint-reviewer` through `task`. Neither
  call carries a model.
- The stage-runner's review prompt carries the persisted `review-backend:
  skill://code-review` verbatim. The sprint-reviewer loads that backend with
  `read skill://code-review`, binds it to the uncommitted worktree diff and the
  stage plan as its spec source, and never asks the user for a fixed point or
  spec.
- The sprint-reviewer fans out the backend's own axes plus the applicable
  security and test-quality risk specialists in **one `task` batch call**, each
  item using the flat read-only agent `reviewer`. Each worker reports findings
  with concrete worktree evidence. The sprint-reviewer synthesizes only
  supported findings, deduplicates them, and neither invents nor upgrades claims
  without evidence.
- When supported findings exist, the sprint-reviewer dispatches a fixer through
  `task` with the flat write-capable agent `task` to change the worktree. It
  then sends the affected areas and fixes to the implicated axes and specialists
  for a focused re-review batch; a review that only reports findings cannot pass
  the gate.
- The fix/re-review loop has an explicit finite cap. A clean focused re-review
  returns `clean` to the sprint-stage-runner, which proceeds through
  verification and landing before returning `landed` to main. Findings still
  unresolved when the cap is reached return `blocked` with the unresolved
  evidence and do not land the stage.
- No model value, role alias, or `model` field appears in any call or prompt, and
  no component asks the user for a model.

## Forbidden

- Any `eval` cell or `agent(...)` bridge call for the reviewer, workers, or
  fixer.
- One bundled or generic reviewer performing the entire gate instead of a
  dedicated sprint-reviewer coordinating parallel backend-axis and risk-brief
  evidence.
- Ignoring the persisted `review-backend`, re-resolving it, downgrading it, or
  substituting a sprint-owned specialist methodology for the backend's own axes.
- Using the `task` agent for review workers: review workers are the read-only
  `reviewer` agent; `task` is reserved for the fixer.
- A headless CLI shortcut (`claude -p` or equivalent) substituting for the
  dispatched gate.
- The `ce:review` PR/comments/todos workflow — as the gate or as the backend;
  this gate reviews and fixes the uncommitted stage worktree.
- Review logic running inline in main, the conductor, or the stage-runner.
- Claude-only mechanics: `Agent(...)`, namespaced agent names such as
  `sprint:sprint-reviewer`, or invoking a Skill tool.
- Serial specialist review when the independent specialists can run in one batch,
  synthesis without cited evidence, fixing without focused re-review, or review
  that reports findings but never applies fixes.
- An unbounded fix/re-review loop, declaring `clean` while supported findings
  remain, or landing after the retry cap instead of returning `blocked`.
- Selecting, pinning, translating, or asking for a review or worker model.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-23 · rewrite for role-bound pure-task review (contract change) · the
  previous revision guarded `eval agent()` worker dispatch pinned to an exact
  review model; workers now go through one `task` batch with models bound by
  agent definitions. Prior log entries retired with the old contract:
  2026-07-11 baseline FAIL as designed; 2026-07-11 post-architecture PASS;
  2026-07-16/17/21 (×2) PASS.
- 2026-07-23 · baseline attempt against pre-rewrite skill · **invalidated** —
  the run overlapped the adapter rewrite and read `runtime-omp.md` mid-edit, so
  it cannot serve as the RED baseline. Discriminating RED coverage for the
  contract change comes from the same-day baselines in
  `omp-native-model-dispatch.md`, `omp-planner-dispatch.md`, and
  `omp-role-rebind.md`, which all produced old-contract `eval agent()` /
  exact-model compositions against the pre-rewrite skill.
- 2026-07-23 · post role-binding rewrite (kimi-code/k3) · **PASS** — the full
  gate composed pure-`task`: main → `sprint-stage-runner` → `sprint-reviewer`,
  backend loaded with `read skill://code-review` and bound to the uncommitted
  diff + stage plan, one `reviewer`-agent batch for Standards/Spec/plan/security/
  test-quality, evidence-only synthesis, flat `task` fixer, focused re-review
  batch, two-round cap, clean → verify → land; no `eval`, no model anywhere.
