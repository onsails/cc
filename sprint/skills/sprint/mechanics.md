# sprint — Mechanics

Exact commands for per-stage lifecycle steps 3–7, run **from the repo root**. The COMMANDS are identical in both modes; only **who dispatches each step** differs (see §0).

## 0. Orchestration modes (read the `Nesting:` header)

WHO runs steps 3–7 depends on the sprint-doc `Nesting:` header (set once by the nesting probe — see SKILL Capability Probes):

- **`Nesting: yes` (nested):** the conductor dispatches **one `sprint:stage-runner` subagent** that runs all of §3–§7 and dispatches the executor (§4) and review (§5) as **nested** subagents. The stage-runner carries the **`Agent` tool** and has **no `model`** (inherits the main/session model, so the §5 review inherits it too). The conductor sees only its terse report.
- **`Nesting: no` (flat):** subagents can't dispatch subagents (e.g. Claude Desktop withholds `Agent` from subagents), so the **conductor** drives the stage, dispatching each isolated step itself (all `main → subagent`, one level): §3 isolate = conductor `git` plumbing; §4 execute = dispatch the executor subagent (mimo → `mimo-code:mimo-delegate` sonnet); §5 review = dispatch a `general-purpose` review subagent (no model override → inherits main); §6 verify = dispatch a verify subagent; §7 land = conductor `git` plumbing. The conductor reads only terse reports — never diffs/logs, never the executor's output.

In both modes: stage code lives only on `$BR` in `$WT`, the review runs at the **main/session model**, and the mimo executor is **sonnet**.

Slugs: `<sprint>` = milestone slug (e.g. `auth`); `<stage>` = stage slug (e.g. `schema`). Let `S=<NN>-<stage>`, `WT=.worktrees/$S`, `BR=feat/<sprint>-$S`. The **stage** branch `$BR` (e.g. `feat/auth-01-schema`) is distinct from the **integration** branch `feat/<sprint>` (e.g. `feat/auth`). Run everything from the **repo root**; never `cd` into `$WT` unscoped — worktree-scoped commands use `git -C "$WT"` or a `(cd "$WT" && …)` subshell, and the land commands (§7) use `git -C "$REPO"` so they always act on the main tree, never the worktree.

## 3. Isolate

Capture the repo root now (cwd is root here), so §7 can act on the main tree regardless of later cwd:
```
REPO=$(git rev-parse --show-toplevel)
git worktree add -b "$BR" "$WT" feat/<sprint> || { echo "blocked: cannot isolate stage $S (worktree add failed)"; exit 1; }
```
**Mandatory, no fallback.** If this fails — integration branch `feat/<sprint>` missing (sprint never started), a dirty main tree, branch `$BR` already exists — **report `blocked` and stop.** Never proceed by editing/committing stage code in the main tree: the entire stage runs inside `$WT` on `$BR`, and stage code reaches the integration branch only via the §7 merge.

## 4. Execute

Read the engine from the sprint-doc `Engine:` header and dispatch the matching variant below. For `Engine: mimo`, the model, variant, and `mimo:<handle>` are **inputs the conductor already resolved** (pre-dispatch: it ran `mimo-resolve`, picked model+variant, minted the per-stage handle `<stage>-<rand4>`, and recorded `mimo:<handle>` on the stage line) and passes to the stage-runner — the stage-runner does **not** resolve them here.

### 4a. Engine: codex

**Fresh run.** The codex runtime is the `task` helper that `codex:rescue` wraps; call it directly so you can target the worktree with `--cwd`:
```
CODEX=$(fd -t f codex-companion.mjs ~/.claude/plugins/marketplaces/openai-codex 2>/dev/null | head -1)
node "$CODEX" task "Implement this plan fully and exactly:
$(cat docs/plans/$S-plan.md)
[+ 'Use subagent-driven-development.' only if the codex-SDD probe found it]" \
  --cwd "$WT" --write --effort <high|xhigh>
```
`--write` → codex runs `workspace-write` (edits files); without it, read-only. For a long stage, add `--background` and poll `node "$CODEX" status` / `node "$CODEX" result`; cap the polling (e.g. abort after N checks). If the session stalls, gets stuck, or stops with the plan unfinished, **resume it (below) before reporting `blocked`.**

**Resume a stuck or stopped session.** codex stopping mid-plan — interrupted, timed out, partial edits, dead `--background` job — is recoverable. **Resume the same thread** so codex keeps its own context, instead of a fresh `task` that re-derives everything and may clobber the partial edits. This is exactly what `codex:rescue --resume` wraps; call the runtime directly to target the worktree:
```
node "$CODEX" status --all --json            # find the job + whether it stopped
node "$CODEX" result <job-id> --json         # background job: stop reason / output
node "$CODEX" task --resume-last --write --cwd "$WT" --effort <high|xhigh> \
  "Your previous run stopped before finishing. Re-read the plan and the current
   worktree state, do only what remains, and complete it fully and exactly:
$(cat docs/plans/$S-plan.md)"
```
`--resume-last` (what `codex:rescue --resume` adds) continues the **last** codex thread — sprints run one stage's codex at a time, so "last" is this stage's. Keep the partial worktree (uncommitted); never commit or land a partial stage. Cap resumes too: after ~2 that still leave the plan unfinished, report `blocked: codex stalled, <N>/<total> files, worktree retained`.

### 4b. Engine: mimo

The stage-runner dispatches `mimo-code:mimo-delegate` as a **nested subagent**, **foreground** (the stage-runner blocks until it returns — never a harness background flag, which would bounce monitoring up to the conductor). This works because the stage-runner is `sprint:stage-runner`, which carries the `Agent` tool. mimo-delegate runs ONE mimo session via the launcher and reads its inputs (`handle`, `cwd`, `model`/`variant`, `prompt`, `mode`) from the **free-text prompt body**, so put them there. It writes files directly into `$WT`; the stage-runner does **not** edit files itself in this variant. mimo-delegate returns `done` only when mimo stopped **and** the worktree diff is non-empty — an empty diff (mimo stopped mid-plan) comes back `incomplete`, so resume it; do not treat empty as done.

`handle` is the bare `<handle>` from the `mimo:<handle>` token on the stage line — **drop the `mimo:` prefix** (mimo-delegate wants `<handle>` matching `[a-z0-9_-]+`, form `<stage>-<rand4>`). `cwd` must be **absolute**: mimo-delegate runs detached and hard-requires it, and `$WT` is the *relative* `.worktrees/$S`, so pass `"$REPO/$WT"` (`$REPO` was captured absolute in §3).

**Fresh run.**
```
Agent(
  subagent_type: "mimo-code:mimo-delegate",
  description: "execute $S",
  prompt: """
  mode: fresh
  handle: <handle>          # bare handle from mimo:<handle> on the stage line
  cwd: "$REPO/$WT"          # absolute
  model: <model from conductor>
  variant: <variant from conductor>
  Implement this plan fully and exactly:
  $(cat docs/plans/$S-plan.md)
  """)
```

**Resume a stuck or stopped session.** If the stage stopped/unfinished, re-dispatch with the **same handle** and `mode: resume`. **CRITICAL: on resume do NOT pass `model` or `variant`** — mimo-delegate resumes by the session id recorded against the handle and takes neither. Never start a fresh session to "resume". mimo retains the plan and worktree context through that recorded session, so the continuation prompt need only say "finish what remains" — unlike codex, re-feeding the full plan is unnecessary:
```
Agent(
  subagent_type: "mimo-code:mimo-delegate",
  description: "resume $S",
  prompt: """
  mode: resume
  handle: <handle>          # same bare handle as the fresh run
  cwd: "$REPO/$WT"          # absolute
  Your previous run stopped before finishing; re-read the plan and the current
  worktree state, do only what remains, and complete it fully.
  """)
```
Cap resumes like codex: after ~2 that still leave the plan unfinished, report `blocked: mimo stalled, <N>/<total>, worktree retained`.

### 4c. Engine: bare

When neither executor is selected/available, the stage-runner implements `docs/plans/$S-plan.md` **itself**, in `$WT` (no further subagent — it *is* the executor).

## 5. Review

**In a separate subagent — mandatory.** The review is dispatched as a `general-purpose` subagent — by the **stage-runner** in nested mode, by the **conductor** in flat mode (§0). It does **not** run inline or as a `claude -p` subprocess: the review reads diffs and rewrites files, so it must stay isolated from the dispatcher's context. The review works on the **uncommitted** working-tree diff (the executor's output), so it runs *before* the commit in §7.

**Which reviewer:** the **vendored `code-review` skill** (built into the runtime, invoked via the **Skill tool**, accepts `<effort> --fix` and applies fixes to the working tree). Do **NOT** `fd`/search the disk for a `code-review` command — that finds the `claude-plugins-official` **PR** plugin, which reviews a GitHub PR (`gh pr comment`) and spawns its own sub-agents (wrong tool, and it can't even run inside a subagent on a no-nesting runtime). Use effort `high|xhigh|max` only — **never `ultra`** (the one multi-agent/cloud variant).

**Model:** dispatch the review with **NO `model` override** so it inherits the dispatcher's model — which is the **main/session model** (in nested mode the stage-runner itself has no model; in flat mode the conductor dispatches it directly). The review is the quality gate; it must run at the main context's model. Setting any `model` here breaks that.

`$WT` is a real on-disk git worktree, so the subagent just makes it the cwd and the diff it sees is the executor's uncommitted output. Exact tool call (substitute `$S`, the `$WT` absolute path, and the effort):
```
Agent(
  subagent_type: "general-purpose",
  # NO model field → inherits the dispatcher's model = the main/session model
  mode: "acceptEdits",        # → "bypassPermissions" only if a *command* prompt stalls it; safe, worktree is disposable
  description: "review $S",
  prompt: """
Your working directory is the worktree <abs $WT> — first action: cd into it, run everything there.
Invoke the VENDORED `code-review` skill via the Skill tool with args: <high|xhigh|max> --fix
(NOT a GitHub-PR /code-review plugin, NOT `ultra`) so it reviews AND applies fixes to the
uncommitted working-tree diff in this worktree.
Work autonomously: apply every fix, never ask for approval, do NOT commit.
Return only `clean`, or a terse bullet list of items you could not resolve. No diffs, no narration.
""")
```
On unresolved items, loop back to step 4. Effort is `high`/`xhigh`/`max` by stage risk (table below), capped at `max`; `ultra` is a cloud multi-agent review the operator triggers manually, never the stage-runner.

## 6. Verify

Run the repo's test/build in a subshell so cwd doesn't leak:
```
(cd "$WT" && nix flake check)     # or: cargo test / npm test
```
On failure, loop back to step 4 with the failures.

## 7. Commit, then land

Codex and `/code-review --fix` leave changes **uncommitted** in the worktree. Commit only if steps 5–6 succeeded — otherwise the merge brings nothing and `git worktree remove` refuses a dirty tree:
```
git -C "$WT" add -A
git -C "$WT" commit -m "feat(<sprint>): stage <NN> <title>"
git -C "$REPO" merge --no-ff "$BR"
git -C "$REPO" worktree remove "$WT" && git -C "$REPO" branch -d "$BR"
```
`$REPO` is already on `feat/<sprint>` (the conductor never left it), so no `git switch` is needed — the merge always lands on the integration branch in the main tree, never in the worktree.

## Effort Scaling

| Stage risk | executor effort/variant (step 4) | review effort (step 5) |
|---|---|---|
| low / cosmetic | high | high |
| normal | xhigh | xhigh |
| risky / wide blast radius | xhigh | max |

codex maps these to `--effort`; mimo maps them to `--variant` (the conductor passes the resolved variant to the stage-runner). `ultra` review is intentionally absent from the auto-flow — escalate to it manually when a stage warrants a cloud review.
