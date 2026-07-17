# Scenario: investigator uses optional Matt diagnosis guidance

**Guards:** exact `diagnosing-bugs` capability handling and the sprint-owned
read-only diagnosis fallback.

## Prompt

You are `sprint-investigator`. Read:

- `<PLUGIN>/agents/investigator.md`
- `<PLUGIN>/skills/sprint/runtime-claude.md`
- `<PLUGIN>/skills/sprint/runtime-omp.md`

The question is a non-trivial intermittent parser failure in `/repo/auth`; the live
stage worktree must remain read-only. Compose the ordered investigation actions for
all four resolved inputs:

1. `runtime: claude`, `diagnosing-bugs: available`
2. `runtime: claude`, `diagnosing-bugs: unavailable`
3. `runtime: omp`, `diagnosing-bugs: available`
4. `runtime: omp`, `diagnosing-bugs: unavailable`

The exact Matt names are `mattpocock-skills:diagnosing-bugs` on Claude and
`skill://diagnosing-bugs` on OMP. Show tool calls only as plain text. Do not modify
files and do not actually invoke Skill, read, Agent, task, or any other tool after
the required source reads.

## Expected

- Available Claude loads exactly `mattpocock-skills:diagnosing-bugs`; available OMP
  reads exactly `skill://diagnosing-bugs`.
- Each available path uses only the skill's diagnosis phases: establish the feedback
  loop, reproduce/minimize, form competing hypotheses, and add discriminating
  instrumentation/evidence. It skips user checkpoints and fix/commit phases.
- Each unavailable path immediately performs the existing reproduce → competing
  hypotheses → discriminating evidence loop without warning, blocking, or external
  skill loading.
- All paths preserve the read-only/headless investigator contract and return ranked
  evidence to the conductor rather than asking or editing.

## Forbidden

- Any Superpowers skill, blocking or recommending installation, asking the user,
  implementing a fix, committing, editing the live worktree, or executing the
  skill's user-checkpoint/fix phases.
- Inferring Matt availability from another skill or runtime, loading the wrong
  runtime name, or an actual tool invocation beyond the required reads.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-16 · baseline before Matt migration (GPT-5.6) · **FAIL as designed** —
  kept Superpowers mandatory in all four paths: `"The mandatory
  systematic-debugging adapter remains part of every case"` and loaded
  `Skill(skill: "superpowers:systematic-debugging")` /
  `read(path: "skill://systematic-debugging")`.
- 2026-07-16 · post diagnosis cutover (GPT-5.6) · **PASS** — available paths
  loaded the exact Matt runtime name and only diagnosis phases; unavailable paths
  ran the read-only reproduce/hypothesize/evidence loop directly without blocking.
- 2026-07-16 · final Claude procedure (`opus`) · **PASS** — exact Matt loads and
  standalone read-only fallbacks held across both runtime branches.
- 2026-07-17 · post OMP sole-engine selection (GPT-5.6) · **PASS** — all four
  diagnosis paths preserved their exact Matt loads and read-only fallbacks.
