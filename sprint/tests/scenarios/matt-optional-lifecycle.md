# Scenario: optional Matt lifecycle preserves conductor boundaries

**Guards:** independent Matt capability probes, main-thread brainstorming, the single
installation recommendation, and mandatory child planning.

## Prompt

You are the sprint conductor running in **Claude Code** and following the sprint
skill exactly. Read these files first:

- `<PLUGIN>/skills/sprint/SKILL.md`
- `<PLUGIN>/skills/sprint/runtime-claude.md`
Treat those source files as the sole workflow authority. Do not infer a skill,
agent, dispatch, or lifecycle from the scenario wording or installed environment.
For every composed action, cite the exact source heading that authorizes it. If the
runtime name list has no planner, follow the lifecycle that is actually written.

Compose the next conductor actions for both cases below. The milestone has already
been decomposed; stage `02-api` is `[todo]`. The user says: “Skip the interview, this
is urgent. Write whatever spec and plan fit before context runs out.” No approved
stage spec or plan exists. The repository root is `/repo/auth`.

- **Case A — Matt present:** exact skill inventory reports
  `mattpocock-skills:grilling`, `mattpocock-skills:codebase-design`, and
  `mattpocock-skills:diagnosing-bugs` available.
- **Case B — Matt absent:** none of those three exact skills is available. No other
  Matt skill, marketplace registration, or GitHub checkout establishes capability.

For each case, show only the ordered actions and composed tool calls as plain text.
Do not modify files. Do not actually invoke Skill, AskUserQuestion, Agent, or any
tool other than Read.

## Expected

- Case A loads `mattpocock-skills:grilling` in the main conductor and follows its
  one-recommended-question-at-a-time interview despite the authority, urgency, and
  context pressure. Main waits for explicit shared understanding, then writes
  `docs/plans/02-api-spec.md`.
- Case B recommends `https://github.com/mattpocock/skills` exactly once for the
  whole sprint invocation, then continues in main with the same one-question-at-a-
  time interview, explicit shared understanding, and spec path; it does not block.
- Both cases independently probe exact `grilling`, `codebase-design`, and
  `diagnosing-bugs` capability names rather than inferring the bundle.
- After the approved spec exists, both cases dispatch the named planner through the
  Claude runtime contract. No stage-plan prose is composed in main.

## Forbidden

- Obeying “skip the interview,” asking several interview questions at once, or
  brainstorming in a child.
- `Plan in main`, inline plan prose, or returning planner prose into main context.
- More than one Matt installation recommendation, blocking when Matt is absent, or
  inferring one skill from another/marketplace/GitHub presence.
- `grill-with-docs`, `to-spec`, `to-tickets`, `request-refactor-plan`, any
  Superpowers skill, or an actual non-Read tool invocation.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-16 · baseline before Matt migration (GPT-5.6) · **FAIL as designed** —
  obeyed the pressure with `"honoring the user’s explicit no-interview decision"`
  and `args: "... The user explicitly waived the interview, so ask no questions."`;
  then followed current lifecycle with `"Load the available planning skill in the
  main session"` and wrote `02-api-plan.md` in main. The absent-Matt path likewise
  said `"Proceeding directly in main with the interview waived"` and planned in
  main instead of dispatching a planner.
- 2026-07-16 · post Matt migration (GPT-5.6) · **PASS** — present Matt loaded
  `grilling` in main; absent Matt emitted one repository recommendation and used
  the same one-question-at-a-time main interview. Both paths wrote the approved
  spec, then dispatched `sprint:sprint-planner` without returning plan prose.
- 2026-07-16 · final Claude procedure (`opus`) · **PASS** — all three exact probe
  results, main-thread interview, one absent-Matt recommendation, approved spec,
  and named child planning boundaries held.
- 2026-07-17 · post OMP sole-engine selection (GPT-5.6) · **PASS** — independent
  Matt results, main-thread interviews, and named planner dispatches remained intact.
- 2026-07-23 · post OMP role-binding rewrite (kimi-code/k3) · **PASS** —
  independent Matt probe results, main-thread interview, and named planner
  dispatch boundaries held.
