# mimo-code plugin — design

Date: 2026-06-13
Status: design approved (brainstorm), not yet implemented
Lives in: `onsails-cc` marketplace (this `cc` submodule)

## Purpose

Run **mimo** coding sessions from Claude Code. mimo is Xiaomi's fork of opencode
(command `mimo`, installed via `pkgs.llm-agents.mimo-code`). Claude stays the
conductor; mimo does the heavy work.

Three goals, all confirmed:

1. **Offload** — push heavy implementation/exploration to mimo (its own model and
   provider subscription) to spare Claude's context and budget.
2. **Write delegation** — let mimo actually edit the workspace; Claude sets the
   task and reviews the diff.
3. **MiMo / chosen-model access** — run on a selected `provider/model` and effort.

Not in scope: parallel fan-out as a primary mode (falls out for free), ACP
transport, a rich job-control CLI.

## Why not ACP, why not a companion

mimo's CLI is opencode 1:1 — `mimo run`, `mimo acp`, `--continue/--session/--fork`,
`-m provider/model`, `--variant`, `--format json`, `--dangerously-skip-permissions`.

- **No ACP.** Headless `mimo run --format json --dangerously-skip-permissions`
  already performs writes and emits a live NDJSON event stream (`sessionID` on
  every line). ACP would only add interactive permission gating and in-protocol
  cancel — deliberately cut. ACP is the expensive, hang-prone part cc-multi-cli
  had to vendor an SDK for; we avoid it entirely.
- **No companion architecture.** mimo *is* the session-bearing runtime (it owns
  session storage and resume). Claude Code's Bash already runs things; the model
  reads the stream. The only fragile bit in pure shell is reliably capturing the
  session id off the first stream line and not corrupting state under
  parallelism. That justifies **one thin launcher script**, nothing more — no
  brokers, no `run-worker`, no six-subcommand dispatcher.

## Three surfaces (keep them distinct — we are not building a CLI)

**1. User → skill (what a human types):**

```
/mimo-code [provider/model] [variant] <task>
```

Positional, no flags. Skill parsing: a leading `xxx/yyy` token is the model; a
following `minimal|low|medium|high|max` token is the variant (effort); the rest is
the task. The skill is model-invoked, so natural language works too
("run mimo on openai/gpt-5.4 high: …"). Model omitted → the resolve flow below.

**2. Skill → subagent:** plain prose in the subagent prompt ("model openai/gpt-5.4,
effort high, task …"). Not flags.

**3. Subagent → launcher (internal machine boundary):** the launcher does **not**
invent a model/variant vocabulary — it forwards mimo's native flags after `--`.
Its own flags are only `--handle`, `--cwd`, `--resume`.

```
mimo-run.mjs --handle <name> --cwd <dir> -- -m openai/gpt-5.4 --variant high "<task>"
   → mimo run --format json --dangerously-skip-permissions -m … --variant … "<task>"

mimo-run.mjs --handle <name> --cwd <dir> --resume -- "<continuation>"
   → reads session id from <handle>.sessionid → mimo run --session <id> --format json … "<continuation>"
```

## Architecture and flow

Main Claude never calls the launcher. The skill **dispatches a sonnet subagent**
(`mimo-delegate`) so the live stream and any waiting stay out of the main context.

```
Main Claude (skill mimo-code)
   │ resolves model/effort (if needed), assigns a UNIQUE handle (slug)
   ▼
Task: subagent mimo-delegate  (model: sonnet — haiku is forbidden)
   │ one foreground Bash call:
   ▼
mimo-run.mjs --handle <name> --cwd <dir> -- -m <model> [--variant <e>] "<task>"
   │ spawns mimo, captures sessionID off line 1 → <handle>.sessionid (atomic),
   │ streams mimo's NDJSON straight through (passthrough), exits with mimo's code
   ▼
subagent watches the live stream in its OWN context, then returns to main thread
   ONLY: a summary + handle + sessionId + changed files (from `git diff`)
```

**Streaming decision.** Foreground, transparent passthrough. The launcher is a
dumb pipe: capture the id as a side effect, forward every line as-is, forward
stderr, exit with mimo's code (~35 lines, no envelope, no jq layer). The subagent
(an LLM) interprets the stream and summarizes. The main thread is never streamed
to — it only gets the distilled summary, so context and tokens are preserved.

**The foreground vs background tradeoff is real and accepted.** A live stream means
the launcher blocks, so a run is bounded by Bash's 10-minute cap. This is *not*
fatal because (a) it runs in a subagent, so the main thread is untouched, and
(b) the captured session id makes a 10-minute kill fully resumable. Capturing the
id therefore solves two problems at once: the explicit "mimo asked a question and
exited" resume case, and the timeout case.

## Resume

When mimo returns incomplete (asked the caller something, or was killed at the
cap), the skill dispatches the subagent again in resume mode with the **same
handle**. The launcher reads the id from `<handle>.sessionid` and runs
`mimo run --session <id> "<continuation>"`.

- **Always `--session <id>`, never `--continue`** — `--continue` attaches to the
  "last" session and pollutes sibling directories, breaking parallelism.
- Resume does **not** re-ask for a model — a mimo session remembers its own model,
  so `-m` is omitted on resume.

## Session registry and parallel safety

Source of truth for a session id is a file, **one per handle**, so concurrent
sessions never write the same file.

```
$XDG_STATE_HOME/mimo-code/<cwd-hash>/<handle>.sessionid   # default ~/.local/state/...
$XDG_STATE_HOME/mimo-code/<cwd-hash>/<handle>.lock
$XDG_STATE_HOME/mimo-code/<cwd-hash>/<handle>.ndjson      # full stream log (debug/resume)
```

- `<cwd-hash>` = `sha256(abs cwd)[:16]` — isolates workspaces.
- `<handle>` = caller slug `[a-z0-9_-]`, unique per delegation. Parallel = distinct
  handles = distinct files. The skill generates unique slugs.

Optional richer sidecar `<handle>.json` (model, variant, status, stopReason,
timestamps) may be written too, but the `.sessionid` text file is the minimum and
the one resume depends on.

**Concurrency guarantees:**

1. **One writer per file** — the launcher process for a handle is the sole writer
   of that handle's files.
2. **Cross-process lock** — launcher does `open(<handle>.lock, 'wx')` (atomic
   exclusive create). `EEXIST` + live pid → "handle busy"; `EEXIST` + dead pid →
   stale reclaim. Released on exit. This is the cross-process lock
   `atomic-state.mjs` called out of scope — a per-handle `O_EXCL` file is the right
   primitive and trivial.
3. **Atomic id write** — temp file + `rename`, mode `0600`.
4. **id written immediately** — on the first NDJSON line carrying `sessionID`, well
   before the run finishes. Context can be lost; the file cannot.
5. Concurrent **writes** in the same cwd are a workspace concern, not a registry
   one: give concurrent write-delegations separate git worktrees. The registry
   stays safe regardless.

## Model / provider / effort resolution

Happens in the **skill (main thread)** — it is user-facing. The `mimo models` /
`mimo providers list` calls are tiny and read-only, so they do not pollute context.

Key fact: `mimo models` lists the whole catalogue (~19 entries: `openai/*`,
`xiaomi/mimo-*`, `mimo/mimo-auto`), but `mimo providers list` shows only
*authenticated* providers (currently just OpenAI oauth). "Currently installed" =
the **intersection** — never offer a model whose provider has no credentials.

Algorithm (only on fresh delegate; resume never re-asks):

1. `--model` given explicitly → use it (+ optional variant), ask nothing.
2. Not given:
   a. `mimo providers list` → authenticated providers (none → stop: "run
      `mimo providers login` first").
   b. `mimo models` → catalogue, filtered to authenticated providers.
   c. Exactly one usable model → auto-pick. Otherwise present the list (grouped by
      provider) and ask. Use AskUserQuestion when ≤4 options; for a longer list,
      print it and have the user name an id (AskUserQuestion caps at 4).
   d. **Effort** = `--variant` (`minimal|low|medium|high|max`, provider-specific).
      Ask separately, with a "default" option that omits `--variant`.
3. Chosen `-m provider/model [--variant X]` is forwarded to the launcher.

Record the chosen model/variant alongside the session id so resume and diagnostics
know how the session was started. Per-model valid-variant lists are available via
`mimo models --verbose` — deferred; for now offer the common set and let mimo
validate.

## Plugin layout

```
cc/mimo-code/
├── .claude-plugin/plugin.json        # name: mimo-code, version 0.1.0
├── skills/mimo-code/SKILL.md         # the only entry point: parse args, resolve
│                                     #   model/effort, dispatch subagent, handle resume
├── agents/mimo-delegate.md           # subagent (model: sonnet), thin forwarder
└── scripts/
    ├── mimo-run.mjs                  # ~35-line launcher: capture id + passthrough stream
    └── test/                         # node:test units + fake-mimo fixture
```

No `commands/` directory — slash commands still load but are legacy; the docs say
use `skills/` for new plugins (matches codex-sprint / rust-dev).

## Errors and edge cases

| Case | Behavior |
|---|---|
| resume but no `<handle>.sessionid` | launcher fails before spawn: "no recorded session for handle" |
| bad `--session` | mimo: 0 stdout, message on stderr, exit 1 → launcher passes stderr + code; subagent reports "session not found" |
| mimo dies before first line (auth/model) | no sessionid written, exit ≠ 0 → subagent surfaces stderr; resume impossible (honest) |
| crash mid-turn | id already on disk → partial result + offer resume |
| 10-minute Bash cap | mimo killed, id saved → resume continues |
| `mimo` not on PATH | spawn error; skill pre-checks `command -v mimo`; `MIMO_BIN` override |
| no authenticated provider | caught in the resolve step before delegating |
| parallel writes in one cwd | registry safe; separate worktrees required (documented) |

## Testing

`node:test`, no network — a **fake-mimo** stub emitting canned NDJSON (with a
`sessionID`), selected via `MIMO_BIN`.

- launcher arg parsing (`--handle/--cwd/--resume`, split on `--`)
- session-id capture from the first line; atomic sidecar write
- resume reads the sidecar and injects `--session`; fails when it is missing
- lock: `wx` create, `EEXIST` → busy, stale pid → reclaim
- e2e smoke with fake-mimo: id capture + stream passthrough + exit code
- live smoke against real `mimo` — manual, gated

## Open items / deferred

- Per-model valid `--variant` enumeration (`mimo models --verbose`).
- Optional readable streaming (forward `.part.text` instead of raw NDJSON) — one
  line, opt-in, not now.
- Optional `status`/`cancel`/`list` UX — only if a real need appears; the lock +
  sidecar already make state inspectable.
- True detached survival across a Claude Code quit (double-fork) — deferred; the
  foreground-in-subagent model is sufficient for now.
```
