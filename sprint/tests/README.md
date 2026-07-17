# sprint — scenario suite

Pressure scenarios guarding the sprint skill's conductor behavior across both
supported runtimes (Claude Code and Oh My Pi). Each file under `scenarios/` is one
re-runnable test: a self-contained prompt for a fresh subagent, plus Expected/
Forbidden behaviors to judge its output against.

## How to run

For each scenario, dispatch a fresh subagent with the scenario's **Prompt** section
verbatim, substituting `<PLUGIN>` with the absolute path of this plugin directory:

- **Claude Code scenarios** (`engine-default.md`, `stage-runner-dispatch.md`,
  `variant-menu.md`, `matt-optional-lifecycle.md`, `planner-dispatch.md`,
  `standalone-sdd.md`, `investigator-matt-fallback.md`): dispatch a
  `general-purpose` subagent **at `opus`**
  (`model: "opus"` — the skill is written for an opus conductor, so test at that
  model; never haiku). **The prompt must keep its no-invocation guard**: the
  subagent composes tool calls as *text output only* — it must never actually
  invoke `AskUserQuestion`/`Agent` (a teammate-backed subagent CAN surface a real
  question to the user; observed 2026-07-02).
- **OMP scenarios** (`omp-engine-availability.md`, `omp-single-native-engine.md`,
  `omp-native-model-dispatch.md`, `omp-nested-review.md`,
  `omp-running-model-repin.md`, `omp-planner-dispatch.md`):
  dispatch a fresh subagent that plays the OMP sprint conductor. It reads only the
  source files named by that scenario's prompt with `read` (OMP has no Skill tool)
  and composes the exact OMP tool calls (`task`, `eval agent(...)`) as text only —
  it must not actually invoke `eval`, `task`, or any agent.

Then, for every scenario:

1. Judge the subagent's output against **Expected** and **Forbidden**. Every
   Expected item must hold; any Forbidden item failing the test.
2. Append one line to the scenario's **Log**: date, pre/post which change, pass/fail,
   and — on failure — the exact rationalization or omission (verbatim), per
   writing-skills.

Run the whole suite after **every** edit to `skills/sprint/SKILL.md`,
`skills/sprint/mechanics.md`, a runtime adapter (`skills/sprint/runtime-claude.md`,
`skills/sprint/runtime-omp.md`), or an agent contract (the Iron Law: no skill edit
without a failing test first — new behavior gets a new scenario *before* the edit).

Scenarios read the real files on disk, so do not run the suite mid-edit.
