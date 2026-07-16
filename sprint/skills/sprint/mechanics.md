# sprint — shared mechanics

This file defines the runtime-neutral stage lifecycle. Run it from the repository root. Load the runtime adapter selected by the sprint document before dispatching any agent:

- [runtime-claude.md](runtime-claude.md)
- [runtime-omp.md](runtime-omp.md)

The sprint's manual branch and worktree remain authoritative. Runtime task isolation does not replace them.

## 0. Resolved stage contract

Before dispatch, the conductor supplies all values below. A runner or child agent must not resolve models, ask the user, or infer omitted pinned state.

```text
runtime: <claude|omp>
engine: <codex|mimo|native|bare>
sprint: <sprint slug>
stage: <NN>-<stage slug>
title: <stage title>
plan: docs/plans/<NN>-<stage>-plan.md
repo: <absolute repository root>
worktree: <absolute repository root>/.worktrees/<NN>-<stage>
review-effort: <high|xhigh|max>
review-model: <exact effective model>
sdd: <available|unavailable>
# mimo:  model: <provider/model>  variant: <variant>  handle: <bare handle>
# native: model: <exact persisted model>
# codex: effort: <high|xhigh>
```

With `Nesting: yes`, main sends one complete contract to the runtime's stage-runner. The runner performs §§3–7 and returns only `landed @<sha>` with a file count or `blocked: <reason>`. With `Nesting: no`, the conductor performs the same sequence and uses the adapter's flat dispatches. In either mode, the conductor never receives diffs, logs, launcher output, or review details.

Let `S=<NN>-<stage>`, `WT=.worktrees/$S`, and `BR=feat/<sprint>-$S`. The integration branch is `feat/<sprint>`.

## 3. Isolate

Capture the repository root and create the stage branch from the integration branch:

```sh
REPO=$(git rev-parse --show-toplevel)
git worktree add -b "$BR" "$WT" "feat/<sprint>" || { echo "blocked: cannot isolate stage $S"; exit 1; }
```

Failure is blocking. Do not fall back to the main checkout. All stage edits, review fixes, verification, and the stage commit occur in `$WT` on `$BR`.

## 4. Execute

Dispatch through the active runtime adapter. The child receives an absolute worktree path and the resolved engine inputs.

### 4a. Codex

Find and invoke the companion runtime directly so `--cwd` targets the worktree:

```sh
CODEX=$(fd -t f codex-companion.mjs ~/.claude/plugins/marketplaces/openai-codex 2>/dev/null | head -1)
node "$CODEX" task "Implement this plan fully and exactly:
$(cat docs/plans/$S-plan.md)" \
  --cwd "$WT" --write --effort <high|xhigh>
```

Append `Use subagent-driven-development.` only when `sdd: available`. The companion's workspace-write sandbox is sufficient; do not bypass its sandbox. A network-dependent build may fail there because §6 performs independent verification.

For a long stage, background execution may be polled with a finite cap. If a thread stops unfinished, inspect its status and resume the same thread:

```sh
node "$CODEX" status --all --json
node "$CODEX" result <job-id> --json
node "$CODEX" task --resume-last --write --cwd "$WT" --effort <high|xhigh> \
  "Your previous run stopped before finishing. Re-read the plan and worktree; complete only what remains."
```

Never start a fresh codex thread over partial work. After about two unsuccessful resumes, return `blocked: codex stalled, worktree retained`.

### 4b. Mimo

The runtime adapter dispatches the mimo delegate in the foreground. The delegate, not the runner or conductor, operates the launcher. Pass the **bare** handle without the `mimo:` stage-row prefix.

Fresh prompt:

```text
mode: fresh
handle: <bare handle>
cwd: <absolute worktree>
model: <exact resolved provider/model>
variant: <exact resolved variant>
sdd: <available|unavailable>
Implement docs/plans/$S-plan.md fully and exactly.
```

When `sdd: available`, explicitly ask mimo to use its subagent skill with one fresh subagent per independent task. Otherwise it implements directly.

An incomplete run resumes through the same delegate and handle:

```text
mode: resume
handle: <same bare handle>
cwd: <same absolute worktree>
Your previous run stopped before finishing. Re-read the plan and worktree; complete only what remains.
```

On resume, do **not** pass model or variant. Never mint a replacement handle. After about two unsuccessful resumes, return blocked and retain the worktree.

### 4c. Native

The adapter dispatches the named stage executor at the conductor-resolved model. It must pass that model explicitly when its runtime does not provide the required inheritance semantics.

Fresh prompt:

```text
runtime: <claude|omp>
executor-model: <exact persisted model>
mode: fresh
cwd: <absolute worktree>
sdd: <available|unavailable>
plan: docs/plans/$S-plan.md
Implement the plan fully and exactly.
```

With `sdd: available`, the executor uses its sprint-owned runtime worker protocol
and does not load an external SDD skill or re-judge suitability. If that
already-resolved worker dispatch cannot spawn, it returns an error and preserves
the worktree for resume; it never downgrades to direct implementation. With
`sdd: unavailable`, the executor implements directly.

`done` requires a non-empty worktree diff and completion of the plan. Resume an incomplete run with the same model and worktree:

```text
runtime: <claude|omp>
executor-model: <same exact persisted model>
mode: resume
cwd: <same absolute worktree>
plan: docs/plans/$S-plan.md
Re-read the plan and current worktree diff; complete only what remains.
```

Native has no separate session handle; the worktree is its persistent state. After about two unsuccessful resumes, return blocked and retain it.

### 4d. Bare

Bare is a last resort only when no named executor is reachable. The stage-runner implements the plan inside the worktree. Prefer native whenever dispatch is possible because native preserves context isolation and explicit model control.

## 5. Review gate

Review the executor's uncommitted worktree diff before committing. The adapter dispatches the dedicated sprint reviewer at the exact effective review model. Review never runs inline in main or the stage-runner, through a headless CLI shortcut, or through a GitHub PR review workflow.

The reviewer:

1. Fans out independent correctness, security, and test-quality specialists in parallel when those areas apply.
2. Requires every finding to cite concrete worktree evidence.
3. Deduplicates supported findings and neither invents nor increases severity without evidence.
4. Dispatches a fixer for supported findings. The fixer changes only the stage worktree and does not commit.
5. Sends affected areas and applied fixes to the relevant specialists for focused re-review.
6. Repeats fix and focused re-review at most two times.
7. Returns `clean` only with no supported unresolved findings. At the retry cap, returns `blocked` with terse unresolved evidence; the stage must not land.

Use `high`, `xhigh`, or `max` review effort from the risk table. Do not use `ultra`. A report-only review cannot pass the gate: fixes require focused re-review.

## 6. Verify

Run the repository's actual focused test/build command inside the worktree:

```sh
(cd "$WT" && nix flake check)     # or the repository's cargo/npm test command
```

On failure, return to execution with the exact failure evidence, then review affected fixes and verify again. Do not land red work.

## 7. Commit and land

Only after clean review and successful verification:

```sh
git -C "$WT" add -A
git -C "$WT" commit -m "feat(<sprint>): stage <NN> <title>"
git -C "$REPO" merge --no-ff "$BR"
git -C "$REPO" worktree remove "$WT" && git -C "$REPO" branch -d "$BR"
```

The main checkout remains on `feat/<sprint>`. The conductor records the merge SHA in the sprint document. Never remove a dirty or blocked worktree.

## Investigation spike

Noisy investigation is not a stage. Dispatch the runtime's named sprint investigator in the foreground with a question, absolute cwd, short context, and whether a live stage worktree is read-only. It may persist a substantial finding under `docs/investigations/`; otherwise it returns only `finding`, `evidence`, `recommendation`, or `blocked`.

The conductor may perform a single narrow lookup itself. Multi-step debugging, browser work, reproduction, or verbose logs belong to the investigator. It never edits a live stage worktree.

## Effort scaling

| Stage risk | codex effort | mimo variant | native recommended model class | review effort |
|---|---|---|---|---|
| low / cosmetic | high | medium | standard | high |
| normal | xhigh | high | standard | xhigh |
| risky / wide blast radius | xhigh | max | strongest | max |

Codex effort and mimo variant are separate vocabularies. Codex uses `high|xhigh`; mimo uses `minimal|low|medium|high|max` and has no `xhigh`. For mimo, ASK with `default`, the table's risk-scaled value (always visible and Recommended), and nearest neighbors up to the runtime's four-option limit. For native, map `standard` and `strongest` to exact models from the runtime catalog, ASK, persist the exact result, and pass it verbatim.
