# codex-sprint — Mechanics

Exact commands for per-stage lifecycle steps 3–7. The conductor never runs these; the **stage-runner subagent** does, **from the repo root**.

Slugs: `<sprint>` = milestone slug (e.g. `auth`); `<stage>` = stage slug (e.g. `schema`). Let `S=<NN>-<stage>`, `WT=.worktrees/$S`, `BR=feat/<sprint>-$S`. The **stage** branch `$BR` (e.g. `feat/auth-01-schema`) is distinct from the **integration** branch `feat/<sprint>` (e.g. `feat/auth`). Run everything from the **repo root**; never `cd` into `$WT` unscoped — worktree-scoped commands use `git -C "$WT"` or a `(cd "$WT" && …)` subshell, and the land commands (§7) use `git -C "$REPO"` so they always act on the main tree, never the worktree.

## 3. Isolate

Capture the repo root now (cwd is root here), so §7 can act on the main tree regardless of later cwd:
```
REPO=$(git rev-parse --show-toplevel)
git worktree add -b "$BR" "$WT" feat/<sprint>
```

## 4. Execute

**Codex present.** The codex runtime is the `task` helper that `codex:rescue` wraps; call it directly so you can target the worktree with `--cwd`:
```
CODEX=$(fd -t f codex-companion.mjs ~/.claude/plugins/marketplaces/openai-codex 2>/dev/null | head -1)
node "$CODEX" task "Implement this plan fully and exactly:
$(cat docs/plans/$S-plan.md)
[+ 'Use subagent-driven-development.' only if the codex-SDD probe found it]" \
  --cwd "$WT" --write --effort <high|xhigh>
```
`--write` → codex runs `workspace-write` (edits files); without it, read-only. For a long stage, add `--background` and poll `node "$CODEX" status` / `node "$CODEX" result`; cap the polling (e.g. abort after N checks) and report `blocked` if it never resolves.

**Codex absent.** The stage-runner implements `docs/plans/$S-plan.md` **itself**, in `$WT` (no further subagent — it *is* the executor).

## 5. Review

Headless, in the worktree. `--permission-mode acceptEdits` is required — without it the run stalls waiting for edit approval. `/code-review` reviews the **uncommitted** working-tree diff (codex's output), so it runs *before* the commit in step 7:
```
(cd "$WT" && claude -p "/code-review <high|max|ultra> --fix" --permission-mode acceptEdits)
```
If it stalls on a **command** (not edit) prompt, escalate to `--permission-mode bypassPermissions` — safe here because the worktree is disposable. Check the exit status; on real failures, loop unresolved items back to step 4. `/code-review` levels are `low/medium/high/max/ultra` — there is **no** `xhigh` here (`xhigh` is a codex effort).

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

| Stage risk | codex effort (step 4) | review effort (step 5) |
|---|---|---|
| low / cosmetic | high | high |
| normal | high | max |
| risky / wide blast radius | xhigh | ultra |
