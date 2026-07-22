# sprint

Orchestrate one large milestone as a series of **brainstorm → plan → execute** stages, tracked in a living sprint doc, with implementation delegated to native subagents on Claude Code or Oh My Pi (OMP), or to **mimo**/**codex** on Claude Code, while the conductor stays in charge.

> You are the foreman. The executor digs.

## What it's for

A milestone too big for a single spec-and-plan — a long, multistage effort that spans sessions and needs several rounds of brainstorming and planning. Instead of one giant plan, you decompose it into stages and drive them one at a time, resuming across sessions from a persistent doc.

**Use when:**

- A milestone needs *multiple* brainstorm/plan rounds, not one spec → done.
- Work spans sessions and you need to resume "what stage am I on".
- You want to hand the coding to an executor while steering design yourself.

**Not for:** a single-spec feature (use a standalone spec/plan workflow) or a one-off task (delegate directly — a plain subagent, `mimo-code`, or `codex:rescue`).

## How it works

- **Lean conductor.** The main session holds only the sprint doc, current stage, decisions, and open questions. Every technical step runs in an isolated git worktree via a subagent, so diffs and build logs never flood it. Noisy *investigation* (debugging, repros, browser work) is likewise delegated to a named `sprint-investigator` subagent that returns a distilled finding.
- **Per-stage lifecycle:** brainstorm a spec in main → dispatch the named `sprint-planner` → isolate a worktree → executor implements → review in a dedicated `sprint-reviewer` subagent that loads the resolved review backend (the review named by the repository's instructions, or the runtime default), fans out its axes plus risk specialists (security, architecture, performance, test-quality), fixes supported findings, and re-reviews → verify → commit & land → update the doc.
- **Executor engines.** Availability is runtime-specific; the orchestration remains the same and only Execute differs:
  - **native** — a named `sprint-stage-executor` subagent on Claude Code or OMP; no external CLI, launcher, or model resolution. The recommended default; the executor model is asked per stage (or pinned).
  - **mimo** — via the `mimo-code` plugin on Claude Code only; provider/model resolved per stage (or pinned).
  - **codex** — via the official Codex plugin on Claude Code only; an optional runtime probe.
- **Nesting.** Each stage can run as one `sprint-stage-runner` subagent that nests the executor and the review gate, keeping the conductor's context clean. On Claude Code this is probed once per sprint (whether child agents get the `Agent` tool). On OMP it requires `task.maxRecursionDepth >= 3` — main → `sprint-stage-runner` → `sprint-reviewer` → parallel review/fixer workers — and is otherwise a configuration fact, not a probe. Without nesting, the conductor drives the same steps flat, one subagent per step.
- **Runtime-specific model dispatch.** Claude Code passes `model` directly on `Agent(...)` and can inherit the session model when it's omitted. OMP's `task` has no per-call model field at all: every executor and review model must be resolved by the conductor up front and threaded explicitly through an `eval agent(prompt, { agent, model })` bridge at each nested dispatch, including resumes.
- The engine (and any model/review pins) are recorded in the sprint-doc header, so cross-session resume keeps the same setup without re-asking.

## Requirements

- **Claude Code or Oh My Pi (OMP).** The skill detects the runtime and loads the matching adapter (`skills/sprint/runtime-claude.md` or `skills/sprint/runtime-omp.md`); an unrecognized runtime stops before dispatch.
- **`mimo-code` — hard plugin dependency, Claude Code engine only.** `sprint/.claude-plugin/plugin.json` declares `"dependencies": ["mimo-code"]`, so installing the Claude Code sprint plugin auto-installs it. OMP has no native mimo delegate and does not offer the engine.
- **Codex — optional, Claude Code only.** The official Codex plugin [`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc) (`codex@openai-codex`) provides `codex:rescue` + the `codex-companion` runtime. It lives in an external marketplace, so it cannot be a hard dependency and remains a runtime probe. OMP does not offer it.
- **OMP nesting depth.** For the nested review gate, the OMP host must configure `task.maxRecursionDepth: 3` or higher.
- **Matt Pocock skills — strongly recommended, optional.** Exact capability probes
  use `grilling`, `codebase-design`, and `diagnosing-bugs`. They improve
  main-thread brainstorming, child planning, and evidence-first diagnosis. Its
  `code-review` skill is one possible instruction-named review backend, never a
  default:

  ```sh
  claude plugin marketplace add mattpocock/skills
  claude plugin install mattpocock-skills@mattpocock
  ```

  A sprint-only install remains fully usable: direct main-thread brainstorming,
  the sprint-owned planner contract, evidence-first diagnosis, and runtime-native
  SDD all have built-in fallbacks. Missing Matt skills never block those paths. A
  code review named by the repository's own instructions (`AGENTS.md`/
  `CLAUDE.md`) always wins as the review backend; otherwise the gate uses the
  runtime's built-in default — Claude Code's bundled `/code-review` skill, or
  OMP's bundled `/review` review (a fan-out of the built-in read-only `reviewer`
  agent).
- A git repository (stages use `git worktree`).

## Usage

| Command | Effect |
| --- | --- |
| `/sprint` | Ask among runtime-supported engines; **native** recommended. OMP currently offers native only. |
| `/sprint native` | Native engine; the executor model is asked per stage. |
| `/sprint native <model>` | Native, pinned to that model for the whole sprint. |
| `/sprint mimo` | mimo on Claude Code; provider/model + variant resolved and asked per stage. On OMP, stop with a missing-integration error. |
| `/sprint mimo <provider/model> [variant]` | mimo on Claude Code, pinned to that model (+variant) for the whole sprint. |
| `/sprint codex` | codex on Claude Code. On OMP, stop with a missing-integration error. |
| `/sprint … review <model>` | Any engine; pins or explicitly repins review to that exact model. On OMP, future children switch in the same session. A flat main-owned active review is cancelled and rerun as a complete gate on the retained worktree/diff; a nested stage-runner-owned gate finishes on its resolved model and the new pin applies to later reviews. |

Describe the milestone after the command. The skill probes capabilities, decomposes the milestone into stages with you, and drives them. Re-invoking `/sprint` with no description resumes at the first non-done stage.

[Skill reference →](./skills/sprint/SKILL.md) · [Scenario suite →](./tests/README.md)
