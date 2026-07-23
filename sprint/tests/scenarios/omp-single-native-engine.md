# Scenario: OMP auto-selects its sole native engine

**Guards:** A runtime with exactly one supported engine does not force a meaningless
engine menu. OMP persists native automatically and — because OMP sprint models are
role-bound by the agent definitions — continues to decomposition without any model
selection.

## Prompt

You are the sprint conductor running in **Oh My Pi (OMP)** and following the sprint
skill exactly. Read only these files first with `read` (OMP has no Skill tool):

- `<PLUGIN>/skills/sprint/SKILL.md`
- `<PLUGIN>/skills/sprint/runtime-omp.md`

Use those two files as the complete engine-selection contract. A new sprint has no
engine argument or persisted engine. Capability probes are complete. The active OMP
adapter exposes exactly the registered agents and dispatch paths documented in
`runtime-omp.md`; no mimo or codex runtime integration exists.

The user says: "OMP only has native. Skip pointless menus and get on with it."

Compose exactly the conductor's next state transition and its next step. Show the
persisted sprint fields and, if an interactive question follows, the complete
`ask` call as plain text. Do not modify files. Do not actually invoke `ask`,
`task`, `eval`, an agent, a CLI, or any other tool; `read` is the only tool you
may call.

## Expected

- Persists `Engine: native` without asking the user to choose an engine.
- No model question, model catalog, executor pin, or review pin follows: OMP
  sprint models are role-bound by the agent definitions, and the sprint document
  records no model fields.
- The conductor proceeds to the milestone lifecycle (decomposition/brainstorm);
  if it asks anything next, the question concerns the milestone, not models or
  engines.

## Forbidden

- Asking an engine question, offering a one-option native menu, or offering `Other`.
- Offering mimo, codex, or bare, or claiming a missing engine integration blocks
  this no-argument case.
- Asking for, auto-selecting, pinning, or fabricating an executor or review
  model, or consulting a model catalog.
- Treating the user's request to skip the engine menu as permission to skip the
  brainstorm, stage approval, or any later lifecycle gate.
- Actually invoking `ask`, `task`, `eval`, an agent, a CLI, or any tool other
  than `read` while composing the response.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-17 · baseline before OMP sole-engine auto-selection · **FAIL as
  designed** — left `Engine:` absent and composed an `ask` with
  `question: "Which available sprint execution engine should this sprint use?"`
  and the single option `label: "native (Recommended)"`.
- 2026-07-17 · post sole-engine selection (GPT-5.6) · **PASS** — OMP persisted
  `Engine: native` without an engine menu and asked only for unresolved models.
- 2026-07-23 · updated for role-bound models (contract change) · the executor and
  review model questions were removed from the OMP lifecycle; the scenario now
  guards that no model selection follows the auto-selected native engine.
- 2026-07-23 · post role-binding rewrite (kimi-code/k3) · **PASS with fix** — the
  first run recorded `Review backend: /review`; after the default-reference
  wording was clarified to `reviewer`, the rerun persisted `Engine: native`,
  `Review backend: reviewer`, no model lines, and proceeded to the milestone
  brainstorm with no model question.
