# sprint — Claude Code runtime adapter

Use this adapter only when the runtime exposes `Agent`, `AskUserQuestion`, and `Skill`.

## Names and skill loading

Claude Code uses plugin-namespaced agent names:

- `sprint:sprint-stage-runner`
- `sprint:sprint-stage-executor`
- `sprint:sprint-reviewer`
- `sprint:sprint-investigator`
- `sprint:sprint-planner`
- `mimo-code:mimo-delegate`
- `mimo-code:mimo-resolve`

Load skills with the `Skill` tool and their namespaced skill names. Never search the filesystem for a similarly named slash command.

The default Claude review backend is the built-in bundled `code-review` skill (the `/code-review` command). The sprint gate binds it to the uncommitted stage worktree at the stage's review effort and never passes `--fix`, `--comment`, a PR target, or `ultra` — fixes are sprint-owned and PR features are prohibited. Any other named review, such as `mattpocock-skills:code-review`, applies only when the repository's or user's instructions explicitly name it. The GitHub PR `/review` workflow can never serve as a sprint review backend.

## Questions and catalogs

Use `AskUserQuestion`. Keep each question to at most four listed options, each with a one-line description; the tool supplies Other for free text.

With no explicit engine, make one `AskUserQuestion` call containing:

1. An engine question with `native` marked **Recommended**, `mimo`, and `codex` only when its probe passed. Describe native as having no external CLI, launcher, or model-resolution machinery.
2. When no prior review decision exists, a bundled review-model question with `inherit session model` marked **Recommended**, plus stronger available Claude models.

Never ask the review-model question in a separate later round when it can be bundled here.

For an unpinned native stage, use the known Claude model catalog; no resolver probe is needed. ASK every stage and mark the risk-scaled model Recommended. For an unpinned mimo stage, dispatch `mimo-code:mimo-resolve`, then follow the shared narrowing rules.

For a low/cosmetic mimo stage, the variant menu must include `default` and `medium`, with `medium` marked **Recommended**. Add nearest neighbors, at most four total; omitted variants remain reachable through Other.

## Stage planning

After main has written an approved stage spec, dispatch the planner in write-capable
mode. Never put a `model` field on this dispatch; the planner inherits the active
Claude session model.

```text
Agent(
  subagent_type: "sprint:sprint-planner",
  mode: "acceptEdits",
  description: "plan <stage>",
  prompt: """
  runtime: claude
  stage: <NN>-<stage>
  title: <stage title>
  cwd: <absolute repository root>
  spec: docs/plans/<NN>-<stage>-spec.md
  output: docs/plans/<NN>-<stage>-plan.md
  codebase-design: <available|unavailable>
  """
)
```

Pass every line exactly once. The planner returns only its status contract; do not
read the plan body back into main. Missing `sprint:sprint-planner` support is
blocking. Missing `codebase-design` is not.

## Nesting

Probe once per sprint by dispatching a one-shot `general-purpose` agent:

```text
Reply with exactly one word: `Agent` if you have a Task/Agent subagent-dispatch tool, else `NONE`.
```

`Agent` or `Task` means `Nesting: yes`; `NONE` means `Nesting: no`. Persist it. Claude Code CLI normally permits nesting; hosts such as Claude Desktop may withhold `Agent` from child agents.

## Nested stage dispatch

With `Nesting: yes`, main makes exactly one dispatch for the whole stage. Do not put a `model` field on this dispatch; the stage-runner inherits the main/session model.

```text
Agent(
  subagent_type: "sprint:sprint-stage-runner",
  description: "stage <S>",
  prompt: """
  runtime: claude
  engine: <codex|mimo|native|bare>
  sprint: <sprint>
  stage: <S>
  title: <title>
  plan: docs/plans/<S>-plan.md
  repo: <absolute repository root>
  worktree: <absolute worktree>
  review-effort: <high|xhigh|max>
  review-model: <exact effective review model>   # include when pinned or raised by native floor; otherwise state session model
  review-backend: <exact resolved review backend>
  sdd: <available|unavailable>
  # engine=mimo: model: <provider/model>  variant: <variant>  handle: <bare handle, no mimo: prefix>
  # engine=native: model: <exact persisted model>
  # engine=codex: effort: <high|xhigh>
  Run this stage through shared mechanics §§3–7. Resolve nothing. Return only
  `landed @<sha>` with a file count, or `blocked: <reason>`.
  """
)
```

The runner prompt must carry every applicable line. For an unpinned review, `review-model` is the main/session model known by the conductor; this makes the contract explicit while preserving Claude's historical session-default behavior. The runner itself still has no model override.

## Nested native execution

The stage-runner dispatches in the foreground:

```text
Agent(
  subagent_type: "sprint:sprint-stage-executor",
  model: <exact persisted executor model>,
  description: "execute <S>",
  prompt: """
  runtime: claude
  executor-model: <exact persisted executor model>
  mode: fresh
  cwd: <absolute worktree>
  sdd: <available|unavailable>
  plan: docs/plans/<S>-plan.md
  Implement the plan fully and exactly. Do not commit.
  """
)
```

Resume with `mode: resume`, the same cwd and dispatch model. The prompt repeats `runtime: claude`, `executor-model: <same exact persisted executor model>`, and the same plan path, then instructs the executor to read the plan and current diff and complete only what remains.

## Nested mimo execution

Dispatch `mimo-code:mimo-delegate` in the foreground. Fresh prompts include `mode: fresh`, bare handle, absolute cwd, exact model, exact variant, SDD, and plan. Resume prompts include `mode: resume`, the same handle and cwd, but **no model or variant**.

The mimo delegate's own agent definition may run at sonnet; that does not change the exact model selected for the mimo session in its prompt.

## Nested review

Dispatch the dedicated reviewer in the foreground:

```text
Agent(
  subagent_type: "sprint:sprint-reviewer",
  model: <exact effective review model>,
  mode: "acceptEdits",
  description: "review <S>",
  prompt: """
  runtime: claude
  cwd: <absolute worktree>
  stage: <S>
  plan: docs/plans/<S>-plan.md
  review-effort: <high|xhigh|max>
  review-model: <exact effective review model>
  review-backend: <exact resolved review backend>
  Review and fix the uncommitted stage diff through the shared review gate.
  Do not commit. Return only `clean` or `blocked: <terse unresolved evidence>`.
  """
)
```

When the user chose session inheritance and the native floor did not raise it, omitting `model` would also inherit correctly in Claude Code. The explicit resolved value above is preferred because the stage contract records what the conductor selected. Never dispatch below the native executor floor.

## Flat mode

With `Nesting: no`, do not send the entire stage to `sprint:sprint-stage-runner`. Main performs shared mechanics in order:

1. Create the manual stage worktree.
2. Dispatch the engine executor directly with the same prompts and model rules above.
3. Dispatch `sprint:sprint-reviewer` directly at the effective review model.
4. Dispatch verification to an isolated child or run the repository command without reading verbose output into main.
5. Commit and land only after clean results.

Every child returns a terse status. Main never runs or monitors mimo/codex launcher internals.

## Investigation

Dispatch `sprint:sprint-investigator` without a model override so it inherits the
conductor's model. Its prompt includes every resolved input:

```text
runtime: claude
diagnosing-bugs: <available|unavailable>
cwd: <absolute repository root or live worktree>
question: <single question>
context: <one to three lines>
worktree: <none|live stage>
```

Pass the independently probed `diagnosing-bugs` flag verbatim. A missing optional
skill never blocks the investigator dispatch.
