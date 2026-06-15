# sprint — Mechanics

Exact commands for per-stage lifecycle steps 3–7. The conductor never runs these; the **stage-runner subagent** does, **from the repo root**.

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

The stage-runner dispatches `mimo-code:mimo-delegate` as a **nested subagent** (the same nesting §5 uses for the review subagent). mimo-delegate runs ONE mimo session via the launcher and writes files directly into `$WT`; the stage-runner does **not** edit files itself in this variant.

**Fresh run.** Dispatch `mimo-delegate` with:
```
handle:  <the mimo:<handle> recorded on the stage line>   # matches [a-z0-9_-]+, form <stage>-<rand4>
cwd:     <abs $WT>
model:   <passed from the conductor>
variant: <passed from the conductor>
prompt:  $(cat docs/plans/$S-plan.md)
mode:    fresh
```

**Resume a stuck or stopped session.** If the stage stopped/unfinished, re-dispatch `mimo-delegate` with the **same handle** and `mode: resume`. **CRITICAL: on resume do NOT pass `model` or `variant`** — mimo-delegate resumes by the session id recorded against the handle and takes neither. Never start a fresh session to "resume":
```
handle:  <same mimo:<handle> as the fresh run>
cwd:     <abs $WT>
prompt:  "Your previous run stopped before finishing; re-read the plan and the
          current worktree state, do only what remains, and complete it fully."
mode:    resume
```
Cap resumes like codex: after ~2 that still leave the plan unfinished, report `blocked: mimo stalled, <N>/<total>, worktree retained`.

### 4c. Engine: bare

When neither executor is selected/available, the stage-runner implements `docs/plans/$S-plan.md` **itself**, in `$WT` (no further subagent — it *is* the executor).

## 5. Review

**In a subagent — mandatory.** The stage-runner dispatches the review as a subagent — the same dispatch it already uses for a `general-purpose` worktree subagent when codex is absent (§4c). It does **not** run `/code-review` inline or as a `claude -p` subprocess: the review reads diffs and rewrites files, so it must stay isolated from the stage-runner's context. `/code-review` reviews the **uncommitted** working-tree diff (codex's output), so review runs *before* the commit in §7.

`$WT` is a real on-disk git worktree, so the subagent just makes it the cwd and the diff it sees is codex's uncommitted output. Exact tool call (substitute `$S`, the `$WT` absolute path, and the effort):
```
Agent(
  subagent_type: "general-purpose",
  mode: "acceptEdits",        # → "bypassPermissions" only if a *command* prompt stalls it; safe, worktree is disposable
  description: "review $S",
  prompt: """
Your working directory is the worktree <abs $WT> — first action: cd into it, run everything there.
Invoke the code-review skill with args: <high|xhigh|max> --fix
so it reviews AND applies fixes to the uncommitted working-tree diff in this worktree.
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
