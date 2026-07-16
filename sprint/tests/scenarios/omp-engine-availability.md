# Scenario: OMP engine availability gates selection and resume

**Guards:** OMP offers and dispatches only engines backed by its active runtime
adapter. A missing mimo or codex integration is a stop condition, whether the engine
comes from a leading argument or persisted sprint state; it never degrades into a
fake delegate, native execution, or bare fallback.

## Prompt

You are the sprint conductor running in **Oh My Pi (OMP)** and following the sprint
skill exactly. Read only these files first with `read` (OMP has no Skill tool):

- `<PLUGIN>/skills/sprint/SKILL.md`
- `<PLUGIN>/skills/sprint/runtime-omp.md`

Use those two files as the complete engine-availability contract. The host's skill
inventory contains `mimo-code` and Claude's `codex:rescue`, but the OMP adapter's
registered-agent list and dispatch sections are exactly what `runtime-omp.md`
documents; no third source or runtime adapter may be consulted. Apply only explicit
availability gates from the active adapter: do not infer that an engine is
unavailable merely because a delegate name or dispatch section is absent.

Compose the conductor's exact response for each independent case:

1. **Interactive selection:** A new sprint has no engine argument. No sprint document
   exists. Use the OMP adapter's registered agents and dispatch paths exactly as
   documented. Compose the `ask` engine question, including every offered option,
   each one-line description, and the option marked Recommended.
2. **Explicit mismatch:** A new invocation begins with the explicit engine argument
   `mimo`. Compose the terminal conductor response and state whether any question or
   dispatch follows.
3. **Persisted mismatch:** An existing sprint document says `Runtime: omp`, `Engine:
   codex`, and `Nesting: yes`. Compose the terminal conductor response and state
   whether any question or dispatch follows.

Output ONLY the three labeled composed responses as plain text. Do not modify files.
Do not actually invoke `ask`, `task`, `eval`, an agent, a CLI, or any other tool;
`read` is the only tool you may call.

## Expected

- The interactive engine menu offers **native only**, with **native marked
  Recommended** and a one-line description. The documented flat
  `sprint-stage-executor` makes native available on OMP.
- The menu does not offer mimo or codex: neither source file defines a resolvable OMP
  mimo delegate or codex runtime integration. Their appearance in the shared engine
  vocabulary does not make them available on this runtime.
- The menu does not offer bare. Bare remains an emergency fallback, not an engine
  choice.
- The explicit `mimo` case reports a missing OMP mimo runtime integration and stops.
  It asks no follow-up question and dispatches nothing.
- The persisted `Engine: codex` case reports a missing OMP codex runtime integration
  and stops. Persisted state does not make an unavailable engine dispatchable; the
  conductor asks no follow-up question and dispatches nothing.
- Both mismatch responses preserve the requested engine name. They do not reinterpret
  it as milestone text or silently replace it.

## Forbidden

- Offering mimo, codex, or bare in the OMP engine menu, or marking anything other
  than native Recommended.
- Treating the shared skill's mimo dependency expectation, the `mimo-code` skill, a
  CLI binary, or Claude's codex integration as an OMP runtime integration.
- Inventing or guessing a delegate name, including `mimo-delegate`,
  `mimo-code:mimo-delegate`, `codex`, `codex-rescue`, a Pi role, or a generic worker.
- Adding a `model` field to `task`, using Claude-only `Agent(...)` syntax, or
  dispatching a named OMP agent that the adapter does not register.
- Falling back from explicit or persisted mimo/codex to native or bare, auto-picking
  another engine, asking the user to select a model, or prompting for a replacement
  engine.
- Running implementation inline, starting a fresh engine session, or continuing
  sprint decomposition after either missing-integration response.
- Actually invoking `ask`, `task`, `eval`, an agent, a CLI, or any tool other than
  `read` while composing the response.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-11 · baseline (pre-OMP engine-availability gate) · **FAIL as designed** —
  offered `"mimo — a delegated mimo session with explicit model, variant, and
  resumable handle"`, accepted the explicit mismatch with `"Explicit engine argument
  accepted: Engine: mimo"`, and said dispatch would proceed `"via the OMP agent that
  owns the mimo delegate"` even though `runtime-omp.md` names no such delegate. It
  also resumed persisted codex because `"No missing-integration stop applies here
  either"`, then composed a stage-runner dispatch with `engine: codex`.
- 2026-07-11 · post-OMP engine-availability contract fix · **GREEN** — native only was offered and marked Recommended; explicit `mimo` and persisted `codex` each reported the missing OMP runtime integration and stopped before questions, worktree creation, or dispatch, with no fallback or invented delegate.
- 2026-07-12 · post-model-repin skill changes · **PASS** — native was the only offered engine and was marked Recommended; explicit `mimo` and persisted `codex` each preserved the requested engine, reported the missing OMP runtime integration, and stopped before questions or dispatch without fallback or an invented delegate.
- 2026-07-16 · post Matt migration (GPT-5.6) · **PASS** — the menu named flat
  `sprint-stage-executor` and offered native only; mimo/codex mismatches stopped
  without substitution or dispatch.
