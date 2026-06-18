# mimo-code

Delegate write-capable coding sessions to the
[`mimo` CLI](https://github.com/XiaomiMiMo/MiMo-Code) (Xiaomi's opencode fork).
Claude stays the conductor; the heavy work and the tokens move to mimo.

## What it does

- `/mimo-code [provider/model] [variant] <task>` — delegate a task to mimo.
- Runs the session inside a sonnet `mimo-delegate` subagent, so the live NDJSON
  stream and any waiting stay out of the main context.
- Captures each mimo session id to a parallel-safe file
  (`$XDG_STATE_HOME/mimo-code/<cwd-hash>/<handle>.sessionid`) so a session can be
  resumed after it stops or is cut off — always by exact `--session <id>`, never
  `--continue`.
- Resolves the model from `mimo models` ∩ authenticated providers and asks you to
  pick (plus effort/variant); skips the prompt when you pass a model explicitly.
- Per-handle `O_EXCL` lock + cwd-namespaced state keep concurrent sessions isolated.

## Requirements

- The `mimo` CLI on `PATH` (override with `MIMO_BIN`), with at least one
  authenticated provider (`mimo providers login`).

## Notes

- Resume is the recovery path for both "mimo asked a clarification" and a host
  run-cap kill — the session id is captured on the first stream line.
- For concurrent **write** delegations, give each its own git worktree.
- **Permissions:** the launcher does **not** use `--dangerously-skip-permissions`.
  It injects a scoped policy via `MIMOCODE_CONFIG_CONTENT`
  (`edit`/`bash`/`webfetch`/`external_directory` → `allow`), merged on top of your
  config. Edits and commands run freely in the workspace; `doom_loop` is left at
  `ask`, which headless `mimo run` **auto-rejects** — a runaway-loop circuit
  breaker (the run comes back incomplete and is resumed, not a token sink). Headless
  mode never blocks on a permission ask, so there is no interactive approval to wait
  on. An existing `MIMOCODE_CONFIG_CONTENT` is merged, not clobbered.
