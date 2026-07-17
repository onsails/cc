# Scenario: OMP nested multi-agent review gate

**Guards:** the OMP review architecture for a nested sprint stage. The review gate
must preserve the hierarchy `main → sprint-stage-runner → sprint-reviewer →
reviewer workers`, use OMP's model-aware agent dispatch for the pinned review model,
and keep all review evidence and repair work outside the conductor and stage-runner contexts.

## Prompt

You are the sprint conductor running in **Oh My Pi (OMP)** and following the sprint
skill exactly. Read these files first with `read` (OMP has no Skill tool):

- `<PLUGIN>/skills/sprint/SKILL.md`
- `<PLUGIN>/skills/sprint/mechanics.md`
- `<PLUGIN>/agents/stage-runner.md`

The sprint doc says:

```text
Engine: native
Nesting: yes
Review: opus (pinned)
```

Execution for stage `02-api` has completed in the worktree. The uncommitted diff
changes authentication policy, request parsing, and tests, so the review must cover
correctness, security, and test quality. The stage may not land until review and
focused re-review are clean.

OMP runtime facts:

- OMP sprint agent names are exact and flat: `sprint-stage-runner`,
  `sprint-stage-executor`, `sprint-reviewer`, and `sprint-investigator`. Plugin
  namespace syntax such as `sprint:sprint-stage-runner` is invalid.
- `task` can run workers in parallel but has no per-call `model` option.
- A model-specific agent dispatch uses `eval agent(prompt, { agent, model })`.
- OMP has no Skill tool. Skills are loaded with `read skill://<name>` when needed.
- This hierarchy requires `task.maxRecursionDepth >= 3`: main dispatches
  `sprint-stage-runner`, `sprint-stage-runner` dispatches `sprint-reviewer`, and
  `sprint-reviewer` dispatches its reviewer/fixer workers.

Task: compose the exact OMP dispatch plan and tool calls, as plain text, from the
main conductor's stage dispatch through the complete review gate. Include the agent
names, where `model: "opus"` is set, parallel specialist review, evidence-only
synthesis, fixing, focused re-review, the retry cap, the reviewer's final
`clean`/`blocked` result returned to the stage-runner, and the runner's final
`landed`/`blocked` result returned to the conductor. Output ONLY the composed plan and calls, no
commentary. Do not modify files and do not actually invoke `eval`, `task`, or any
agent; `read` is the only tool you may call.

## Expected

- The configured hierarchy is explicit: `main → sprint-stage-runner →
  sprint-reviewer →` parallel flat-named specialist workers and a flat-named fixer.
  The runtime sets `task.maxRecursionDepth` to at least `3`.
- Main dispatches flat agent `sprint-stage-runner`. The stage-runner dispatches flat
  agent `sprint-reviewer` with `eval agent(..., { agent: "sprint-reviewer", model:
  "opus" })`; it does not try to put a model on `task`.
- The sprint-reviewer fans out independent correctness, security, and test-quality
  specialists in parallel. Each specialist reports findings with concrete evidence
  from the worktree. The sprint-reviewer synthesizes only supported findings,
  deduplicates them, and neither invents nor upgrades claims without evidence.
- When supported findings exist, the sprint-reviewer dispatches a fixer to change
  the worktree. It then sends the affected areas and fixes to the relevant
  specialists for a focused re-review; a review that only reports findings cannot
  pass the gate.
- The fix/re-review loop has an explicit finite cap. A clean focused re-review
  returns `clean` to the sprint-stage-runner, which proceeds through verification
  and landing before returning `landed` to main. Findings still unresolved when the
  cap is reached return `blocked` with the unresolved evidence and do not land the stage.
- Any skill instructions needed by an OMP agent are loaded with `read
  skill://<name>`, never a Skill tool or a headless slash-command shortcut.

## Forbidden

- One bundled or `general-purpose` reviewer performing the entire gate instead of a
  dedicated sprint-reviewer coordinating parallel specialist evidence.
- A headless `/review`, `claude -p`, or equivalent shortcut.
- The `ce:review` PR/comments/todos workflow; this gate reviews and fixes the
  uncommitted stage worktree.
- Review logic running inline in main, the conductor, or the stage-runner.
- Claude-only mechanics: `Agent(...)`, namespaced agent names such as
  `sprint:sprint-stage-runner`, `sprint:sprint-reviewer`, or
  `sprint-reviewer:security`, or invoking a Skill tool.
- Supplying `model` to `task`, omitting the pinned `opus` model from the
  stage-runner's `eval agent` dispatch, or letting a reviewer choose/downgrade it.
- Serial specialist review when the independent specialists can run in parallel,
  synthesis without cited evidence, fixing without focused re-review, or review
  that reports findings but never applies fixes.
- An unbounded fix/re-review loop, declaring `clean` while supported findings remain,
  or landing after the retry cap instead of returning `blocked`.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-11 · baseline (pre-OMP nested-review architecture) · **FAIL as designed** —
  current mechanics §5 dispatches one namespaced Claude
  `Agent(subagent_type: "general-purpose", model: <review model>)` and tells it to
  `"Invoke the VENDORED code-review skill via the Skill tool ... --fix"`. It defines
  neither flat OMP `stage-runner → sprint-reviewer → parallel specialists/fixer`
  nesting nor `maxRecursionDepth >= 3`, evidence-only synthesis, focused re-review,
  or a capped fix/re-review loop that returns `blocked`; OMP also cannot execute its
  `Agent` or Skill-tool calls.
- 2026-07-11 · post-OMP nested-review architecture (GPT-5.6) · **PASS** — configured
  `task.maxRecursionDepth: 3`; preserved `main → sprint-stage-runner →
  sprint-reviewer → reviewer/fixer workers`; pinned every `eval agent()` call to
  `opus`; ran evidence-only specialist review in parallel; and enforced fixing,
  focused re-review, a two-round cap, and the clean → verify → land lifecycle.
- 2026-07-16 · post Matt migration (GPT-5.6) · **PASS** — depth three, exact
  pinned review model, parallel evidence workers, fixer, focused re-review, and
  two-round cap all remained intact.

- 2026-07-17 · post sole-engine selection (GPT-5.6) · **PASS** — depth-three
  nested review, parallel evidence, repair, re-review, and retry cap remained intact.
