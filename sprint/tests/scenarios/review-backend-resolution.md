# Scenario: review backend resolution

**Guards:** the conductor-owned review backend resolution (SKILL.md, **Review
backend**). The backend comes from the repository's or user's instructions when
they name a concrete code review, otherwise from the runtime's built-in default.
It is resolved once per sprint, persisted verbatim as `Review backend:`, and
passed to every review dispatch. PR/tracker-only reviews are never valid
backends, and third-party skills such as Matt Pocock's `code-review` apply only
when instructions explicitly name them.

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
name any code review. OMP's built-in flat `reviewer` agent is registered.

### Case C — no instructions, Claude default

Runtime: Claude Code. No instruction names a code review. Claude Code's built-in
bundled `code-review` skill (the `/code-review` command) is available.

### Case D — no instructions, Claude default missing

Runtime: Claude Code. No instruction names a code review. Claude Code's built-in
bundled `code-review` skill is not available in this host.

### Case E — instructions name only a PR workflow

Runtime: OMP. The repository's `CLAUDE.md` says: "Review changes with
`ce:review`," a workflow that operates on pull requests, comments, and todos.

Output ONLY the five labeled resolutions (`CASE A` … `CASE E`), each with the
exact resulting header line or blocked outcome and its authorizing source, no
commentary. Do not modify files and do not actually invoke `eval`, `task`, or any
agent; `read` is the only tool you may call.

## Expected

- **Case A:** `Review backend: review-rust-code` — the exact reference named by the
  repository instructions wins over any runtime default.
- **Case B:** `Review backend: reviewer` — the OMP runtime default is the built-in
  flat `reviewer` agent, with the sprint's two fixed briefs (correctness and
  plan-conformance) as the primary axes.
- **Case C:** `Review backend: code-review` — the Claude runtime default is the
  built-in bundled `code-review` skill (the `/code-review` command).
- **Case D:** the stage is `blocked: no review backend`. No fallback to a generic
  agent or inline review.
- **Case E:** `ce:review` is rejected as a PR/tracker-only workflow and resolution
  falls through to the OMP runtime default `reviewer`.
- Every resolved backend is persisted verbatim and passed as `review-backend:` on
  each review dispatch; only an explicit user instruction can replace it later.

## Forbidden

- Asking the user to choose a backend, or inventing a backend not named by the
  instructions or the runtime adapter.
- Defaulting to a third-party skill such as `mattpocock-skills:code-review` or
  `skill://code-review` when no instruction explicitly names it — those are
  examples of instruction-named backends, never runtime defaults.
- Recommending `mattpocock/skills` as part of backend resolution; that
  recommendation belongs only to the grilling/codebase-design/diagnosing-bugs
  capability probes.
- 2026-07-21 · post built-in-default correction (kimi-code/k3) · **PASS** — all
  five cases resolved per the corrected contract: instructions-named backend wins
  (A), OMP defaults to the built-in `reviewer` agent (B), Claude defaults to the
  built-in bundled `code-review` skill (C), a missing Claude default blocks
  without a Matt recommendation (D), and the PR/tracker-only `ce:review` falls
  through to the OMP default (E).
- Accepting `ce:review` or any PR/comments/todos workflow as the review backend.
- Substituting a generic agent, a bundled inline review, or a headless CLI
  shortcut for the resolved backend.
- Inferring a backend from a marketplace registration, plugin presence, or a
  similarly named skill instead of the exact probed name.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-21 · post review-backend rework (kimi-code/k3) · **PASS (superseded
  contract)** — passed against the initial backend-resolution contract, which
  incorrectly made `skill://code-review`/`mattpocock-skills:code-review` the
  runtime defaults. The user then corrected the defaults: Claude's built-in
  `/code-review` and OMP's built-in `reviewer` agent; Matt's skill only when
  instructions explicitly name it. Cases B–E rewritten accordingly.
