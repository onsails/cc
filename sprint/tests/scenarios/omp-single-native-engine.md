# Scenario: OMP auto-selects its sole native engine

**Guards:** A runtime with exactly one supported engine does not force a meaningless
engine menu. OMP persists native automatically, while leaving unresolved executor
and reviewer model choices to the next interactive question.

## Prompt

You are the sprint conductor running in **Oh My Pi (OMP)** and following the sprint
skill exactly. Read only these files first with `read` (OMP has no Skill tool):

- `<PLUGIN>/skills/sprint/SKILL.md`
- `<PLUGIN>/skills/sprint/runtime-omp.md`

Use those two files as the complete engine-selection contract. A new sprint has no
engine argument or persisted engine. Capability probes are complete. The active OMP
adapter exposes exactly the registered agents and dispatch paths documented in
`runtime-omp.md`; no mimo or codex runtime integration exists. The native executor
model and once-per-sprint review model have not been selected.

The user says: "OMP only has native. Skip pointless menus and get on with it."

Compose exactly the conductor's next state transition and next interactive tool call.
Show persisted sprint fields and the complete `ask` call as plain text. Do not modify
files. Do not actually invoke `ask`, `task`, `eval`, an agent, a CLI, or any other
tool; `read` is the only tool you may call.

## Expected

- Persists `Engine: native` without asking the user to choose an engine.
- Does not pin an executor model merely because native was auto-selected.
- The next `ask` concerns the unresolved native executor model and bundles the
  once-per-sprint review-model question as required by the OMP adapter.
- Model options use exact available OMP provider/model ids supplied by the runtime;
  the answer must use explicit placeholders rather than inventing a catalog.
- The conductor performs no worktree creation, planning, or stage dispatch before
  those model choices are resolved.

## Forbidden

- Asking an engine question, offering a one-option native menu, or offering `Other`.
- Offering mimo, codex, or bare, or claiming a missing engine integration blocks
  this no-argument case.
- Auto-selecting or fabricating the executor or review model.
- Treating the user's request to skip the engine menu as permission to skip model
  selection, review selection, stage approval, or any later lifecycle gate.
- Actually invoking `ask`, `task`, `eval`, an agent, a CLI, or any tool other than
  `read` while composing the response.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-17 · baseline before OMP sole-engine auto-selection · **FAIL as
  designed** — left `Engine:` absent and composed an `ask` with
  `question: "Which available sprint execution engine should this sprint use?"`
  and the single option `label: "native (Recommended)"`.
- 2026-07-17 · post sole-engine selection (GPT-5.6) · **PASS** — OMP persisted
  `Engine: native` without an engine menu and asked only for unresolved models.
