# sprint

Orchestrate one large milestone as a series of **brainstorm → plan → execute** stages, tracked in a living sprint doc, with the implementation delegated to an executor engine (**native** Claude subagents, **mimo**, or **codex**) while Claude stays the conductor.

> You are the foreman. The executor digs.

## What it's for

A milestone too big for a single spec-and-plan — a long, multistage effort that spans sessions and needs several rounds of brainstorming and planning. Instead of one giant plan, you decompose it into stages and drive them one at a time, resuming across sessions from a persistent doc.

**Use when:**

- A milestone needs *multiple* brainstorm/plan rounds, not one spec → done.
- Work spans sessions and you need to resume "what stage am I on".
- You want to hand the coding to an executor while steering design yourself.

**Not for:** a single-spec feature (use `superpowers:brainstorming` → `writing-plans` → execute) or a one-off task (delegate directly — a plain subagent, `mimo-code`, or `codex:rescue`).

## How it works

- **Lean conductor.** The main context holds only the sprint doc, current stage, decisions, and open questions. Every technical step runs in an isolated git worktree via a subagent, so diffs and build logs never flood it. Noisy *investigation* (debugging, repros, browser work) is likewise delegated to a `sprint:investigator` subagent that returns a distilled finding.
- **Per-stage lifecycle:** brainstorm a spec → write a plan → isolate a worktree → executor implements → code review in a subagent (the vendored `code-review` skill, `--fix`) → verify → commit & land → update the doc.
- **Three engines.** The same orchestration drives any of them; only the Execute step differs:
  - **native** — a `sprint:stage-executor` Claude subagent; no external CLI, no launcher, no model resolution. The recommended default; the Claude model is asked per stage (or pinned).
  - **mimo** — via the `mimo-code` plugin (a hard dependency, always present); provider/model resolved per stage (or pinned).
  - **codex** — via the official Codex plugin, an *optional* runtime probe.
- **Nesting probe.** Once per sprint the skill probes whether the runtime grants subagents the `Agent` tool: if yes, each stage runs as one `sprint:stage-runner` subagent that nests the executor and review; if no (e.g. Claude Desktop), the conductor orchestrates the stage flat, one subagent per step.
- The engine (and any model/review pins) are recorded in the sprint-doc header, so cross-session resume keeps the same setup without re-asking.

## Requirements

- **`mimo-code` — hard dependency.** `sprint/.claude-plugin/plugin.json` declares `"dependencies": ["mimo-code"]`, so installing `sprint` auto-installs `mimo-code`.
- **Codex — optional.** The official Codex plugin [`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc) (`codex@openai-codex`) provides `codex:rescue` + the `codex-companion` runtime. It lives in an external marketplace, so it can't be a hard dependency — it stays a runtime probe.
- **Best with:** [`superpowers`](https://github.com/obra/superpowers-marketplace) for specs & plans (the skill degrades and tells you what's missing).
- A git repository (stages use `git worktree`).

## Usage

| Command | Effect |
| --- | --- |
| `/sprint` | Ask which engine (native · mimo · codex if present); **native** recommended. |
| `/sprint native` | Native engine; the Claude model is asked per stage. |
| `/sprint native <model>` | Native, pinned to that Claude model for the whole sprint. |
| `/sprint mimo` | mimo; provider/model + variant resolved and asked per stage. |
| `/sprint mimo <provider/model> [variant]` | mimo, pinned to that model (+variant) for the whole sprint. |
| `/sprint codex` | codex. |
| `/sprint … review <model>` | Any engine; pins the per-stage code review to that Claude model (default: the review inherits the session model). |

Describe the milestone after the command. The skill probes capabilities, decomposes the milestone into stages with you, and drives them. Re-invoking `/sprint` with no description resumes at the first non-done stage.

[Skill reference →](./skills/sprint/SKILL.md) · [Scenario suite →](./tests/README.md)
