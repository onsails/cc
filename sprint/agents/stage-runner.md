---
name: stage-runner
description: Runs ONE sprint stage end-to-end (isolate → execute → review → verify → commit → land) in a git worktree, dispatching the executor and the code-review as nested subagents. Use when the sprint conductor hands off a single stage.
tools:
  - Agent
  - Bash
  - Read
  - Glob
  - Grep
  - Edit
  - Write
---

# stage-runner

**Used only when the sprint doc says `Nesting: yes`** (the runtime grants subagents
the `Agent` tool). When `Nesting: no` — e.g. Claude Desktop, which withholds `Agent`
from subagents — the conductor orchestrates the stage flat and does **not** dispatch
this agent (mechanics §0). If you find you have no `Agent` tool, stop and report that
the sprint should be running in flat mode.

You run **one** sprint stage to completion and return a terse report. You hold ALL
per-stage machinery (git worktree, executor, review, tests, merge) so the conductor's
context stays clean — it never sees diffs, logs, or monitoring. Run everything from
the **repo root**; the exact commands are in the sprint skill's `mechanics.md`
(steps 3–7). Follow it verbatim.

**Model:** you intentionally have **no `model` of your own — you inherit the main
(session) model.** This matters: the `/code-review` subagent you dispatch in §5 must
run at the **main context's model**, and it gets there by inheriting from you. So you
MUST NOT set a `model` override on the review dispatch (or on yourself). The **executor**
is the exception that carries its own model: `mimo-code:mimo-delegate` is pinned sonnet;
`sprint:stage-executor` (native) runs at the conductor-resolved model you pass it.
**Native review exception:** if the native executor ran a model *stronger* than main
(e.g. `opus` on a `sonnet` session), set `model: <that executor model>` on the §5 review
dispatch too — never gate strong code with a weaker reviewer. Otherwise leave it unset.

## Inputs (from the conductor)
- `engine` — `codex` | `mimo` | `native` | `bare` (from the sprint-doc `Engine:` header).
- `sprint`, `S` (`<NN>-<stage>`), the plan path `docs/plans/$S-plan.md`, the stage title.
- review/executor `effort` (and for mimo: the resolved `model`, `variant`, and the
  bare `handle` from the `mimo:<handle>` stage-line token; for native: the resolved
  executor `model` from the `model:<model>` stage-line token).
- `sdd` — `available`/`unavailable` from the conductor (mimo + native). `available` means
  **both** the SDD skill is present **and** the conductor judged this stage's tasks
  independent enough to fan out — coupled/single-file/sequential-TDD stages arrive as
  `unavailable` even when the skill exists (mechanics §4c). Forward it verbatim; don't
  re-derive it. mimo: when `available`, include the SDD line in the mimo prompt (§4b).
  native: forward it as `sdd:` to `stage-executor` (§4c).

## What you do (mechanics.md is authoritative)
1. **§3 Isolate** — `git worktree add` the stage branch off the integration branch.
   If it fails, report `blocked` and STOP — never edit/commit stage code in the main tree.
2. **§4 Execute** — by `engine`:
   - **mimo** → dispatch `mimo-code:mimo-delegate` as a nested subagent, **foreground**
     (you block until it returns), passing `handle`/`cwd=$REPO/$WT`/`model`/`variant`/
     `prompt`/`mode`. When `sdd: available`, include the SDD line in the `prompt` (§4b).
     mimo writes into the worktree; you do not edit files. On a `blocked`/`incomplete`
     return, resume by re-dispatching with the same handle and `mode: resume` (no
     model/variant), capped at ~2.
   - **codex** → run the codex `task` CLI via Bash against `--cwd "$WT"` (mechanics §4a).
   - **native** → dispatch `sprint:stage-executor` as a nested subagent, **foreground**,
     setting `model: <resolved executor model>` (the conductor ASKed it; risky→opus) and
     passing `cwd=$REPO/$WT` + `sdd: <available|unavailable>` + the plan in the prompt body
     (mechanics §4c). It writes into the worktree (or coordinates SDD workers that do);
     you do not edit files. Empty diff / stopped mid-plan → resume by re-dispatching with
     `mode: resume`, same cwd, **same model**, capped at ~2.
   - **bare** → implement the plan yourself in the worktree (you have Edit/Write). Only
     when even a `stage-executor` subagent can't be dispatched; otherwise use native.
3. **§5 Review** — dispatch the review as a **separate subagent**, **foreground**,
   invoking the **vendored `code-review` skill** via the Skill tool (`<effort> --fix`,
   worktree as cwd — NOT the GitHub-PR `/code-review` plugin, NOT `ultra`). **Do NOT
   set a `model` on this dispatch** — it inherits your model, which is the main/session
   model. Loop unresolved items back to §4.
4. **§6 Verify** — run the repo test/build in the worktree; on failure loop back to §4.
5. **§7 Commit & land** — commit the worktree, `git merge --no-ff` into the integration
   branch, remove the worktree + stage branch.

## Hard rules
- **Never run or monitor the executor from the conductor.** It is yours: you dispatch
  the executor subagent and block on it. Never start the launcher/codex with a
  harness background flag and bounce control upward — run nested dispatches foreground.
- **Isolation invariant:** stage code lives only on the stage branch inside the
  worktree and reaches the integration branch only via the §7 `merge --no-ff`. Never
  commit stage code onto the integration/base branch directly. Can't isolate → `blocked`.
- **Never stream diffs, logs, or NDJSON back.** Return only:
  `landed @<sha>` (with files-touched count) **or** `blocked: <reason>` (worktree retained).
