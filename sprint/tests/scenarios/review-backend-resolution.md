# Scenario: review backend resolution

**Guards:** the conductor-owned review backend resolution (SKILL.md, **Review
backend**). The backend comes from the repository's or user's instructions when
they name a concrete code review, otherwise from the runtime default. It is
resolved once per sprint, persisted verbatim as `Review backend:`, and passed to
every review dispatch. PR/tracker-only reviews are never valid backends.

## Prompt

You are the sprint conductor following the sprint skill exactly. Read these files
first with `read` (OMP has no Skill tool):

- `<PLUGIN>/skills/sprint/SKILL.md`
- `<PLUGIN>/skills/sprint/runtime-omp.md`
- `<PLUGIN>/skills/sprint/runtime-claude.md`

A new sprint is starting. No `Review backend:` line exists yet. Resolve the review
backend for each independent case below, state the exact resulting `Review
backend:` header line (or the exact blocked outcome), and name the source that
authorizes it. Resolution is conductor-owned: never ask the user to pick a
backend.

### Case A — instructions name a review

Runtime: OMP. The repository's `AGENTS.md` says: "After significant changes, run
the `review-rust-code` subagent for Rust code." No other review is named.

### Case B — no instructions, OMP default

Runtime: OMP. Neither the repository instructions nor the user-level instructions
name any code review. `read skill://code-review` succeeds.

### Case C — no instructions, OMP skill missing

Runtime: OMP. No instruction names a code review. `read skill://code-review`
returns "Unknown skill". The built-in flat `reviewer` agent is registered.

### Case D — no instructions, Claude default missing

Runtime: Claude Code. No instruction names a code review. The
`mattpocock-skills:code-review` skill is not installed.

### Case E — instructions name only a PR workflow

Runtime: OMP. The repository's `CLAUDE.md` says: "Review changes with
`ce:review`," a workflow that operates on pull requests, comments, and todos.
`read skill://code-review` succeeds.

Output ONLY the five labeled resolutions (`CASE A` … `CASE E`), each with the
exact resulting header line or blocked outcome and its authorizing source, no
commentary. Do not modify files and do not actually invoke `eval`, `task`, or any
agent; `read` is the only tool you may call.

## Expected

- **Case A:** `Review backend: review-rust-code` — the exact reference named by the
  repository instructions wins over any runtime default.
- **Case B:** `Review backend: skill://code-review` — the OMP runtime default.
- **Case C:** the built-in flat `reviewer` agent becomes the backend, with the
  sprint's two fixed briefs (correctness and plan-conformance) as the primary
  axes. The stage is not blocked while this last resort exists.
- **Case D:** recommend `https://github.com/mattpocock/skills` exactly once, then
  the stage is `blocked: no review backend`. No fallback to a generic agent or
  inline review.
- **Case E:** `ce:review` is rejected as a PR/tracker-only workflow and resolution
  falls through to the OMP runtime default `skill://code-review`.
- Every resolved backend is persisted verbatim and passed as `review-backend:` on
  each review dispatch; only an explicit user instruction can replace it later.

## Forbidden

- Asking the user to choose a backend, or inventing a backend not named by the
  instructions or the runtime adapter.
- Accepting `ce:review` or any PR/comments/todos workflow as the review backend.
- Blocking Case C while the built-in `reviewer` agent is available, or blocking
  Case B without attempting `read skill://code-review`.
- Substituting a generic agent, a bundled inline review, or a headless CLI
  shortcut for the resolved backend.
- Repeating the `mattpocock/skills` recommendation URL more than once, or
  recommending it in cases where a backend resolved.
- Inferring a backend from a marketplace registration, plugin presence, or a
  similarly named skill instead of the exact probed name.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-21 · post review-backend rework (kimi-code/k3) · **PASS** — all five
  cases resolved per contract: the instructions-named backend won (A), the OMP
  skill default resolved (B), the built-in `reviewer` agent served as last resort
  with the two fixed briefs (C), the missing Claude default produced exactly one
  mattpocock/skills recommendation plus `blocked: no review backend` (D), and the
  PR/tracker-only `ce:review` was rejected with fall-through to the runtime
  default (E).
