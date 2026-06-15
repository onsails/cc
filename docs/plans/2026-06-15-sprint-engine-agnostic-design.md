# sprint — engine-agnostic (codex + mimo) — Design

Date: 2026-06-15
Status: design approved, implementation pending

## Problem

We have `codex-sprint`: a skill that runs one large milestone as staged
`brainstorm → plan → codex-execute` cycles in a living sprint doc. We want the same
sprint orchestration to be able to delegate implementation to **mimo** (via the
existing `mimo-code` plugin) instead of codex.

Hard constraint: **single source of truth**, no duplicated files or wording, so
maintaining both engines stays cheap. Symlinks are unacceptable because a user may
install only one plugin — a symlink from one plugin into a sibling breaks when the
sibling is absent.

## Decision

**One engine-agnostic `sprint` skill**, not two parallel skills. The orchestration
(decomposition, sprint doc, per-stage lifecycle, isolation invariant, review/verify/
land, red flags) is ~80% engine-neutral and lives in exactly one place. Only the
executor selection, step 4 (Execute), and a couple of resume lines are
engine-specific.

This is zero duplication by construction — there is nothing to keep in sync.

### Rejected alternatives

- **Two skills + codegen from shared fragments** — keeps `/codex-sprint` and
  `/mimo-sprint` as distinct entrypoints, materializes both from shared partials via
  a committed generator. Works, but adds a generator + the discipline of never
  hand-editing generated files. Unification removes the problem entirely.
- **Shared "sprint-core" plugin referenced at runtime** — same failure mode as
  symlinks: breaks when only one of the dependents is installed.

## Naming / migration

`codex-sprint` plugin and skill are renamed to `sprint`. Honest name for an
engine-neutral skill. This is a breaking rename within our own `onsails-cc`
marketplace (acceptable — we own it).

## Executor availability

- **mimo — guaranteed.** `sprint/.claude-plugin/plugin.json` declares
  `"dependencies": ["mimo-code"]`. Claude Code natively supports plugin
  dependencies (plugin.json `dependencies` array of names or `{name, version}`):
  installing `sprint` auto-installs and enables `mimo-code` at the same scope;
  `plugin prune` cleans orphans. Source:
  code.claude.com/docs/en/plugins-reference. So `mimo-delegate` (and the new
  `mimo-resolve`) are always present.
- **codex — optional.** It lives in the external `openai-codex` marketplace, so it
  cannot be a hard dependency. It stays a **runtime probe** (`codex:rescue` in the
  skills list).
- **bare** — general-purpose subagent implementing in the worktree; last-resort
  fallback if somehow neither executor is present.

## Executor selection (recorded in the sprint doc header)

1. Explicit arg `/sprint mimo …` or `/sprint codex …` always wins. If `codex` is
   requested but absent → tell the user to install the codex plugin (or explicitly
   opt into bare).
2. No arg:
   - codex present (probe) → **AskUserQuestion: mimo vs codex** (both available;
     consistent with mimo-code's "ASK, do not default").
   - codex absent → **mimo** (the only guaranteed engine; nothing to ask).
3. Neither → bare.

The chosen engine is written to the sprint-doc header so cross-session resume uses
the same engine without re-asking:

```
# <Milestone> — Sprint
Integration: feat/<sprint>  ·  Base: master
Engine: mimo (model: <provider/model>, variant: <v>[, pinned])   # or: Engine: codex
```

## mimo model resolution

**By default the model is resolved on EVERY mimo stage run**, never once-per-sprint.
Each run, before launch, check **authenticated providers first**, then the model
catalogue, and use the intersection — exactly mimo-code's existing policy.

**Exception — explicit pin.** Only if the user EXPLICITLY pins a provider/model for
the whole sprint (e.g. `/sprint mimo <provider/model> [variant]`, or an explicit
"default to X for the whole sprint") do we skip the per-stage ask. The pinned model
is recorded as `Engine: mimo (model: …, variant: …, pinned)` and reused by every
stage.

### Shared resolution component (SSoT) — new `mimo-resolve` subagent

Resolution logic is shared between `mimo-code` and `sprint` via a **new subagent in
mimo-code**, not duplicated prose. Because `sprint` hard-depends on `mimo-code`, the
component is guaranteed present.

`mimo-code/agents/mimo-resolve.md` (model: **sonnet**; tools: Bash, Read):

- Resolves the runtime: `RUNNER=$(command -v bun || command -v node)` (bun
  preferred, node fallback).
- Calls `"$RUNNER" "$LAUNCHER" resolve-models --json` (new launcher subcommand,
  below).
- Returns a structured list of authenticated `{provider, model}` options, the
  available variants, and a flag if zero providers are authenticated (so the
  conductor tells the user to run `mimo providers login`). Plus a recommendation.
- **Does NOT ask the user.** Gathering only — keeps the verbose `mimo providers
  list` / `mimo models` output out of the conductor context (same principle as
  `mimo-delegate` keeping NDJSON out). The conductor does the AskUserQuestion /
  auto-pick.

This also changes mimo-code's own SKILL.md to resolve via `mimo-resolve` instead of
inline reads → mimo-code version bump.

### New launcher subcommand

`mimo-code/scripts/mimo-run.mjs` gains a `resolve-models --json` subcommand that
runs providers∩models and emits JSON. Single integration seam with mimo, testable
(mimo-code already has a test suite). The `.mjs` stays runtime-agnostic (only
`node:` builtins, which bun also implements).

## Per-stage lifecycle

Steps 1–2 (brainstorm, plan) and 8 (update doc) run in the conductor and are
engine-neutral. Steps 3, 5, 6, 7 (isolate / review / verify / commit+land) are
**identical** to the current codex-sprint and unchanged. Only step 4 (Execute)
becomes engine-specific, plus a mimo pre-step.

**Pre-step (conductor, engine=mimo, unless pinned):** dispatch `mimo-resolve` →
AskUserQuestion / auto-pick → got `model`/`variant`; generate a unique per-stage
handle `<stage>-<rand4>` and record it on the stage line.

**Step 4, engine=mimo (inside the stage-runner):** the stage-runner dispatches
`mimo-delegate` as a nested subagent (same nesting the codex variant uses for the
review subagent), passing `handle`, `cwd=$WT` (absolute), `model`/`variant`,
`prompt = plan contents`, `mode: fresh`. mimo writes files into `$WT`.

**Resume (stage unfinished), engine=mimo:** re-dispatch `mimo-delegate` with the
SAME handle (read from the stage line), `mode: resume`, a continuation prompt. No
`--continue` — resume by recorded session id. Cap resumes (~2 → `blocked`), as codex.

**Step 4, engine=codex:** unchanged — `task --cwd "$WT" --write --effort …`, resume
via `task --resume-last`.

Stage line gains the mimo handle (analogous to `wt:`):

```
2. [executing] API — spec:02-api-spec.md plan:02-api-plan.md wt:.worktrees/02-api mimo:api-7f3a
```

codex needs no handle (`--resume-last` covers one-codex-stage-at-a-time).

## Runtime: bun with node fallback

Everywhere the launcher is invoked, prefer bun, fall back to node:
`RUNNER=$(command -v bun || command -v node)`; then `"$RUNNER" "$LAUNCHER" …`.

- `mimo-delegate.md`: `node "$LAUNCHER"` → `"$RUNNER" "$LAUNCHER"`.
- `mimo-resolve.md`: same.
- `package.json` test script: prefer bun, fallback node (confirm bun's `node:test`
  compatibility during implementation; node `--test` remains the fallback).
- `.mjs` files: no logic change; already only `node:` builtins.

## File changes (in the `cc` submodule)

1. `git mv codex-sprint sprint`; `git mv sprint/skills/codex-sprint sprint/skills/sprint`.
2. `sprint/skills/sprint/SKILL.md` — `name: sprint`; new description/triggers
   (codex+mimo); probe table → executor row + mimo-resolve/pin; step 4
   two-variant; `Engine:` header in sprint doc; mimo handle on stage line; update
   Common Mistakes / Red Flags.
3. `sprint/skills/sprint/mechanics.md` — §4 two-variant (codex + mimo) + mimo
   model-resolution pre-step. §3, §5, §6, §7 unchanged.
4. `sprint/.claude-plugin/plugin.json` — `name: sprint`,
   `dependencies: ["mimo-code"]`, new description, version bump.
5. `sprint/README.md` — rewrite.
6. `mimo-code`: new `agents/mimo-resolve.md` (sonnet); `scripts/mimo-run.mjs`
   `resolve-models --json` subcommand + tests; `agents/mimo-delegate.md` and
   SKILL.md switched to bun-with-node-fallback and resolve-via-`mimo-resolve`;
   version bump.
7. `.claude-plugin/marketplace.json` — `codex-sprint` → `sprint`.
8. Submodule discipline: commit inside `cc` → push `cc` first → bump the gitlink in
   the `nix-config` superproject → home-manager activation.

## Verification

- `mimo-code` launcher tests pass under bun and node (`resolve-models` covered).
- Installing `sprint` auto-pulls `mimo-code`.
- `/sprint mimo`, `/sprint codex`, `/sprint` (probe + ASK) each select the right
  engine.
- Resume reads `Engine:` + per-stage handle and continues on the same engine.
- codex path behaves exactly as before (regression).
```
