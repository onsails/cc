# sprint — Oh My Pi runtime adapter

Use this adapter only when the runtime exposes `task`, `ask`, `eval`, and `read` for `skill://` URIs. OMP has no Claude `Agent`, `AskUserQuestion`, or `Skill` tool.

## Runtime configuration

Nested sprint review has four levels:

`main → sprint-stage-runner → sprint-reviewer → reviewer/fixer workers`

Configure:

```text
task.maxRecursionDepth: 3
```

A higher value is valid. A value below 3 cannot run the nested review gate and is blocking. OMP nesting is determined by the configured recursion depth and each agent definition's `spawns`; do not run Claude's self-reporting nesting probe.

OMP agent names are exact and flat. The installed agent definition's exact `name` is authoritative; pass it verbatim and never add a namespace or translate it. The current OMP package registers:

- `sprint-stage-runner`
- `sprint-stage-executor`
- `sprint-reviewer`
- `sprint-investigator`
- built-in specialist worker `reviewer`
- built-in write-capable fixer `task`


Names such as `sprint:sprint-stage-runner` are invalid. Do not replace a named sprint agent with a Pi role, generic worker, or inline conductor logic.

## Skills

Load skill instructions with the read tool:

```text
read(path: "skill://<name>")
```

OMP has no Skill tool. An agent that needs a skill reads its `skill://` URI itself. Do not use a headless slash-command shortcut for sprint execution or review.

## Engine availability

OMP currently supports the **native** executor only. No OMP-native mimo delegate or codex task runtime is installed. Do not offer `mimo` or `codex` in the engine menu. If an explicit argument or persisted sprint selects either engine, report the missing OMP runtime integration and stop before model selection, worktree creation, or dispatch. Do not replace it with native or bare.

## Questions and model catalogs

Only the interactive conductor uses `ask`. Child OMP sessions are headless and cannot ask. All model and variant choices therefore happen before stage dispatch.

Build native executor menus from the models the active OMP runtime exposes. Preserve full provider/model ids and mark the risk-scaled choice Recommended. Do not translate a Claude-style alias to another OMP id unless the user selected that exact catalog entry.

Bundle the once-per-sprint review-model question into an existing engine or first-stage question. The Recommended default is the conductor's active session model. Persist an explicit choice verbatim as `Review: <model> (pinned)`.

OMP `agent()` does **not** inherit the caller's active model when `model` is omitted; it falls back to the called agent's static definition. Therefore even the session-model default must be resolved by main and passed as an exact string through the stage contract and every model-specific nested dispatch. Never omit a model expecting session inheritance.

The `model` option on OMP `agent()` accepts an exact available provider/model id, not only `default`/`smol`/`slow` roles or agent-frontmatter defaults. A new child can use a different exact model in the same main session. This changes neither the main session model nor any running child and requires no OMP restart, role rebinding, or frontmatter edit.

## Main to stage-runner

OMP `task` has no per-call `model` field. It dispatches the stage-runner at the model fixed by that agent's definition. This is an API restriction, not model inheritance.

With `Nesting: yes`, main dispatches the entire stage in one batch call:

```text
task({
  agent: "sprint-stage-runner",
  context: "Sprint <sprint>. Manual sprint worktrees are authoritative. Return only landed or blocked status.",
  tasks: [{
    id: "stage-<NN>",
    assignment: """
    runtime: omp
    engine: <native|bare>
    sprint: <sprint>
    stage: <NN>-<stage>
    title: <title>
    plan: docs/plans/<NN>-<stage>-plan.md
    repo: <absolute repository root>
    worktree: <absolute worktree>
    review-effort: <high|xhigh|max>
    review-model: <exact resolved model>
    sdd: <available|unavailable>
    # native: model: <exact persisted executor model>
    Run shared mechanics §§3–§7. Resolve nothing. Return only `landed @<sha>`
    with a file count, or `blocked: <reason>`.
    """
  }]
})
```

There is **no `model` field anywhere in this `task` call**, including its task item. The assignment must carry the exact executor and review models because the runner resolves neither.

For the `01-api` example, the assignment must literally include all of:

```text
runtime: omp
engine: native
sprint: auth
stage: 01-api
title: API
plan: docs/plans/01-api-plan.md
repo: /repo/auth
worktree: /repo/auth/.worktrees/01-api
review-effort: xhigh
review-model: anthropic/claude-opus-4-6
sdd: available
model: anthropic/claude-sonnet-4-6
```

## Model-specific nested dispatch

Dynamic OMP model dispatch must occur inside an `eval` JavaScript or Python cell that calls the model-aware agent bridge. A pseudo-call outside `eval`, or a `model` field on `task`, is invalid.

### Native execution

The stage-runner constructs the executor prompt from its resolved assignment, then calls `eval` with a JavaScript cell semantically equivalent to:

```js
const executorPrompt = `
runtime: omp
executor-model: anthropic/claude-sonnet-4-6
mode: fresh
cwd: /repo/auth/.worktrees/01-api
sdd: available
plan: docs/plans/01-api-plan.md
Implement the plan fully and exactly. Do not commit.
`;
await agent(executorPrompt, {
  agent: "sprint-stage-executor",
  model: "anthropic/claude-sonnet-4-6",
  label: "execute-01-api"
});
```

In tool-call form:

```text
eval({ language: "js", title: "execute 01-api", code: "<the cell above>" })
```

Use the persisted model verbatim in both places: `executor-model` inside the prompt lets the executor propagate it to SDD grandchildren, while `model` in `agent()` selects the executor process. Resume uses another eval cell with `runtime: omp`, the same `executor-model`, `agent`, and `model`, `mode: resume`, the same absolute cwd, and the plan path.

### Unsupported engines

Mimo and codex execution are unavailable on OMP until a concrete OMP-native delegate/runtime is installed and named by this adapter. Never invent a flat delegate name, reuse a Claude-only agent, or dispatch either engine through `task` or `eval`. An explicit or persisted selection returns the missing-integration error from **Engine availability**.

### Review

After execution, the stage-runner dispatches the dedicated reviewer in a separate eval cell:

```js
const reviewPrompt = `
runtime: omp
cwd: /repo/auth/.worktrees/01-api
stage: 01-api
plan: docs/plans/01-api-plan.md
review-effort: xhigh
review-model: anthropic/claude-opus-4-6
Review and fix the uncommitted stage diff through the complete sprint review gate.
Do not commit. Return only clean or blocked with unresolved evidence.
`;
await agent(reviewPrompt, {
  agent: "sprint-reviewer",
  model: "anthropic/claude-opus-4-6",
  label: "review-01-api"
});
```

In tool-call form:

```text
eval({ language: "js", title: "review 01-api", code: "<the cell above>" })
```

The exact persisted review model is present in `agent()` options. Never let the called agent's frontmatter default replace it.

### Review repin

Follow the shared explicit-repin transition only after confirming the exact requested model appears in OMP's active model catalog. If it does not resolve, leave the existing pin and running work unchanged. With `Nesting: no`, main directly owns the review child: record its exact label, cancel only that child through OMP's task/job lifecycle, retain the manual worktree and current diff, then persist the new `Review:` header and start a new complete `sprint-reviewer` gate from an `eval` cell. Do not resume the cancelled child. Put the new exact model in both `review-model` inside `reviewPrompt` and `model` in `agent()`. Pass the cancelled child's exact label unchanged, plus the same absolute worktree, stage id, and plan path. The replacement prompt must explicitly require the complete evidence-only specialist review, supported-finding fixes, and focused re-review gate against the retained current diff. No model belongs on `task`.

With `Nesting: yes`, main owns `sprint-stage-runner` and the active reviewer is its grandchild. Main must not cancel, reparent, or directly redispatch that reviewer, mutate the runner's resolved review model, or cancel the runner merely to switch models. Persist the new `Review:` pin for future ordinary reviews and let the current nested gate finish at its already-resolved model. With no active review child, persist the repin immediately and use it in both model locations on the next ordinary review dispatch; do not start review early. Executor pins remain unchanged.

OMP never has a vendored Claude `code-review --fix` path or a `Skill` tool. On resume or after a repin, ignore any stale session instruction that says otherwise and use the dedicated `sprint-reviewer` gate above.

## OMP review gate

The sprint-reviewer, not main or the stage-runner, owns all findings and fixes. It uses its received `review-model` verbatim for every child dispatch.

Independent specialists run concurrently inside one eval cell with `parallel()`:

```js
const reviewModel = "anthropic/claude-opus-4-6";
const worktree = "<absolute worktree>";
const stage = "02-api";
const plan = "docs/plans/02-api-plan.md";
const reviewEffort = "xhigh";
const efforts = [
  ["correctness-02-api", "Review correctness and cite file:line evidence."],
  ["security-02-api", "Review authentication and parsing security; cite file:line evidence."],
  ["tests-02-api", "Review test quality and missing behavioral coverage; cite file:line evidence."]
];
const findings = await parallel(efforts.map(([label, focus]) => async () =>
  agent(`runtime: omp\ncwd: ${worktree}\nstage: ${stage}\nplan: ${plan}\nreview-effort: ${reviewEffort}\nreview-model: ${reviewModel}\n${focus}\nDo not edit.`, {
    agent: "reviewer",
    model: reviewModel,
    label
  })
));
```

The reviewer synthesizes only evidence present in these results and deduplicates overlapping findings. It does not invent, upgrade, or preserve unsupported claims.

When supported findings exist, it dispatches the flat write-capable fixer from an eval cell:

```js
await agent(fixerPrompt, {
  agent: "task",
  model: reviewModel,
  label: "fix-02-api"
});
```

The fixer prompt contains `runtime: omp`, the absolute worktree, plan path, exact `review-model`, and supported evidence, requires fixes without commits, and returns affected areas. The sprint-reviewer then sends those areas and fixes back to the relevant flat `reviewer` specialists, concurrently through `parallel()`, for focused re-review. Every focused re-review prompt repeats `runtime: omp`, the plan path, and exact `review-model`. A finding-only review cannot return clean.

Cap the fix/focused-re-review loop at **two repair rounds**. A clean focused re-review returns `clean` to the stage-runner, which continues with verification and landing; only its final `landed` or `blocked` status returns to main. Findings remaining after round two return `blocked` with unresolved evidence. A blocked stage is not committed or landed.

Every worker and fixer dispatch uses `eval agent(prompt, { agent, model, label })`; none puts `model` on `task`.

## Flat mode

If configuration or `spawns` cannot support the required hierarchy, persist `Nesting: no`. Main then drives the shared manual lifecycle one step at a time. It still uses model-aware eval cells for native execution and sprint review, exact flat names, explicit models, and separate child contexts. It does not inline implementation or review.

## Investigation

Dispatch `sprint-investigator` with the model-aware eval bridge and the conductor's explicitly resolved active model. Its prompt includes `runtime: omp`, `model: <same exact resolved active model>`, an absolute cwd, question, short context, and live-worktree read-only rule; the `agent()` options repeat that exact model.
