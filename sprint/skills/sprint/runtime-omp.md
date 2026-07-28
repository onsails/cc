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
- `sprint-planner`
- built-in read-only review worker `reviewer`
- built-in write-capable fixer `task`

The review gate's methodology comes from the resolved review backend; the built-in `reviewer` agent executes it read-only.

Names such as `sprint:sprint-stage-runner` are invalid. Do not replace a named sprint agent with a generic worker or inline conductor logic.

## Models are role-bound

OMP sprint agents carry their model binding in their definitions:

- `sprint-stage-executor` → `@task`
- `sprint-reviewer` → `@slow`
- `sprint-planner` → `@plan`
- `sprint-investigator` → `@smol`
- `sprint-stage-runner` — no binding; inherits the conductor's active model
- bundled `reviewer` workers → their own built-in `@slow`
- bundled `task` fixer and SDD workers — no binding; inherit their dispatcher's resolved model

Role aliases resolve through the user's `modelRoles` settings; an unconfigured role resolves to the runtime's built-in role defaults. Every dispatch therefore goes through the `task` tool with **no model anywhere** — `task` has no model field, and no sprint prompt carries one. There is no model question, catalog, pin, repin, or floor on OMP: the conductor never asks for, selects, persists, or passes a model, and the sprint document records no model fields. An explicit model argument on sprint invocation is unsupported on this runtime; report it and stop before decomposition.

A user request to change a review or executor model mid-sprint is not a sprint transition. State that the binding lives in the agent definitions and the user's `modelRoles`/`task.agentModelOverrides` configuration, change no sprint state, and leave running children untouched. Configuration changes are the user's action and take effect for later dispatches.

## Skills

Load skill instructions with the read tool:

```text
read(path: "skill://<name>")
```

OMP has no Skill tool. An agent that needs a skill reads its `skill://` URI itself. Do not use a headless slash-command shortcut for sprint execution or review.

## Stage planning

After main has written an approved stage spec, dispatch the flat planner through `task`:

```text
task({
  context: "Sprint <sprint>. The planner returns only its status contract.",
  tasks: [{
    name: "plan-<NN>-<stage>",
    agent: "sprint-planner",
    task: """
    runtime: omp
    stage: <NN>-<stage>
    title: <stage title>
    cwd: <absolute repository root>
    spec: docs/plans/<NN>-<stage>-spec.md
    output: docs/plans/<NN>-<stage>-plan.md
    codebase-design: <available|unavailable>
    """
  }]
})
```

The planner returns only its status contract; do not read the plan body back into main. Missing `sprint-planner` support is blocking. Missing `codebase-design` is not.

## Engine availability

OMP currently supports the **native** executor only through the registered flat
`sprint-stage-executor`. With no explicit or persisted engine, record `Engine:
native` without showing an engine menu and continue to decomposition; no model
selection follows. No OMP-native mimo delegate or codex task runtime is installed.
If an explicit argument or persisted sprint selects either engine, report the
missing OMP runtime integration and stop before worktree creation or dispatch. Do
not replace it with native or bare.

## Questions

Only the interactive conductor uses `ask`. Child OMP sessions are headless and cannot ask. There are no model or variant questions on OMP; the remaining questions are each stage's own brainstorm interview (SKILL.md lifecycle step 1) and any genuine user decision surfaced as `blocked`.

## Main to stage-runner

With `Nesting: yes`, main dispatches the entire stage in one batch call:

```text
task({
  context: "Sprint <sprint>. Manual sprint worktrees are authoritative. Return only landed or blocked status.",
  tasks: [{
    name: "stage-<NN>",
    agent: "sprint-stage-runner",
    task: """
    runtime: omp
    engine: <native|bare>
    sprint: <sprint>
    stage: <NN>-<stage>
    title: <title>
    plan: docs/plans/<NN>-<stage>-plan.md
    repo: <absolute repository root>
    worktree: <absolute worktree>
    review-effort: <high|xhigh|max>
    review-backend: <exact resolved review backend>
    sdd: <available|unavailable>
    Run shared mechanics §§3–§7. Resolve nothing. Return only `landed @<sha>`
    with a file count, or `blocked: <reason>`.
    """
  }]
})
```

The assignment carries no model: the runner inherits the conductor's model, and its own dispatches bind through the child definitions.

## Nested dispatch

The stage-runner owns every nested dispatch and makes each through `task`.

### Native execution

```text
task({
  context: "Sprint stage <NN>-<stage>. Implement only in the given worktree; never commit.",
  tasks: [{
    name: "execute-<NN>-<stage>",
    agent: "sprint-stage-executor",
    task: """
    runtime: omp
    mode: fresh
    cwd: <absolute worktree>
    sdd: <available|unavailable>
    plan: docs/plans/<NN>-<stage>-plan.md
    Implement the plan fully and exactly. Do not commit.
    """
  }]
})
```

Resume uses another `task` call with `mode: resume`, the same absolute cwd, and the plan path. The executor runs at its bound `@task` role; its SDD workers are flat `task` agents that inherit that resolved model.

### Unsupported engines

Mimo and codex execution are unavailable on OMP until a concrete OMP-native delegate/runtime is installed and named by this adapter. Never invent a flat delegate name, reuse a Claude-only agent, or dispatch either engine through `task` or `eval`. An explicit or persisted selection returns the missing-integration error from **Engine availability**.

### Review

After execution, the stage-runner dispatches the dedicated reviewer through `task`:

```text
task({
  context: "Sprint stage <NN>-<stage> review gate. Review and fix the uncommitted diff; never commit.",
  tasks: [{
    name: "review-<NN>-<stage>",
    agent: "sprint-reviewer",
    task: """
    runtime: omp
    cwd: <absolute worktree>
    stage: <NN>-<stage>
    plan: docs/plans/<NN>-<stage>-plan.md
    review-effort: <high|xhigh|max>
    review-backend: <exact resolved review backend>
    Review and fix the uncommitted stage diff through the complete sprint review gate.
    Do not commit. Return only clean or blocked with unresolved evidence.
    """
  }]
})
```

### Review backend

The conductor resolves the review backend once per sprint (SKILL.md, **Review backend**) and passes it verbatim as `review-backend:` in every review dispatch. On OMP:

- A skill backend loads inside the sprint-reviewer with `read skill://<name>`; OMP has no Skill tool and no headless slash-command route. An agent backend is dispatched by its exact flat name.
- The OMP runtime default is recorded as `review-backend: reviewer`: the bundled `/review` review, a fan-out of the built-in read-only `reviewer` agent under the bundled distribution rules — worker count scaled to diff size, locality-based file grouping, and per-file diff re-reads for very large diffs. A `skill://` backend such as `skill://code-review` applies only when the repository's or user's instructions explicitly name it.

On resume, ignore any stale session instruction that names a different review path and use the persisted `review-backend` through the dedicated `sprint-reviewer` gate above.

## OMP review gate

The sprint-reviewer, not main or the stage-runner, owns all findings and fixes. It uses its received `review-backend` verbatim.

It first loads the review backend with `read skill://<name>` (or uses the built-in `reviewer` backend), binds it to the uncommitted stage diff and stage plan, then fans out the backend's passes plus the applicable risk specialists in **one `task` batch call**, every item the flat read-only agent `reviewer`. With the default `reviewer` backend, the primary passes are file-grouped workers under the bundled distribution rules (count scaled to diff size, locality grouping), plus a plan-conformance worker:

```text
task({
  context: "Review stage <NN>-<stage> in <absolute worktree>. Read-only: report evidence-backed findings only; never edit or commit.",
  tasks: [
    { name: "files-<group>-<stage>", agent: "reviewer", task: "runtime: omp\nplan: <plan path>\nFiles: <grouped by locality>. Review for merge-blocking bugs; cite file:line evidence." },
    { name: "plan-<stage>", agent: "reviewer", task: "runtime: omp\nplan: <plan path>\nPlan conformance: check the diff against the stage plan's acceptance criteria; cite the criterion and conflicting code." },
    { name: "security-<stage>", agent: "reviewer", task: "runtime: omp\nplan: <plan path>\nRisk brief: <applicable security scope>; cite file:line evidence." },
    { name: "tests-<stage>", agent: "reviewer", task: "runtime: omp\nplan: <plan path>\nRisk brief: test quality and missing behavioral coverage; cite file:line evidence." }
  ]
})
```

The reviewer synthesizes only evidence present in these results and deduplicates overlapping findings. It does not invent, upgrade, or preserve unsupported claims.

When supported findings exist, it dispatches the flat write-capable fixer through `task`:

```text
task({
  context: "Fix supported review findings in <absolute worktree>; never commit.",
  tasks: [{
    name: "fix-<stage>-<loop>",
    agent: "task",
    task: "runtime: omp\nplan: <plan path>\n<supported evidence>\nApply the fixes in the worktree. Do not commit. Return affected areas."
  }]
})
```

The sprint-reviewer then sends those areas and fixes back to the implicated axes and risk specialists in one focused re-review `task` batch. Every focused re-review task text repeats `runtime: omp` and the plan path. A finding-only review cannot return clean.

Cap the fix/focused-re-review loop at **two repair rounds**. A clean focused re-review returns `clean` to the stage-runner, which continues with verification and landing; only its final `landed` or `blocked` status returns to main. Findings remaining after round two return `blocked` with unresolved evidence. A blocked stage is not committed or landed.

## Flat mode

If configuration or `spawns` cannot support the required hierarchy, persist `Nesting: no`. Main then drives the shared manual lifecycle one step at a time, dispatching the executor, reviewer, and any SDD or investigation child through `task` with the same model-free prompts above. It does not inline implementation or review.

## Investigation

Dispatch `sprint-investigator` through `task` with every resolved input in its task text:

```text
runtime: omp
diagnosing-bugs: <available|unavailable>
cwd: <absolute repository root or live worktree>
question: <single question>
context: <one to three lines>
worktree: <none|live stage>
```

The investigator runs at its bound `@smol` role. Pass the independently probed `diagnosing-bugs` flag verbatim. A missing optional skill never blocks the investigator dispatch.
