# sprint

Orchestrate one large milestone as a series of **brainstorm → plan → execute** stages, tracked in a living sprint doc, with the implementation delegated to an executor (codex *or* mimo) while Claude stays the conductor.

> You are the foreman. The executor digs.

## What it's for

A milestone too big for a single spec-and-plan — a long, multistage effort that spans sessions and needs several rounds of brainstorming and planning. Instead of one giant plan, you decompose it into stages and drive them one at a time, resuming across sessions from a persistent doc.

**Use when:**

- A milestone needs *multiple* brainstorm/plan rounds, not one spec → done.
- Work spans sessions and you need to resume "what stage am I on".
- You want to hand the coding to an executor while steering design yourself.

**Not for:** a single-spec feature (use `superpowers:brainstorming` → `writing-plans` → execute) or a one-off task (use `codex:rescue` or `mimo-code` directly).

## How it works

- **Lean conductor.** The main context holds only the sprint doc, current stage, decisions, and open questions. Every technical step runs in an isolated git worktree via a subagent, so diffs and build logs never flood it.
- **Per-stage lifecycle:** brainstorm a spec → write a plan → isolate a worktree → executor implements → headless `/code-review --fix` → verify → commit & land → update the doc.
- **Two executors.** The same orchestration drives either engine; only the Execute step differs:
  - **mimo** — via the `mimo-code` plugin (a hard dependency, always present).
  - **codex** — via the official Codex plugin, an *optional* runtime probe.
- The chosen engine is recorded in the sprint-doc header so cross-session resume keeps the same engine without re-asking.

## Requirements

- **`mimo-code` — hard dependency.** `sprint/.claude-plugin/plugin.json` declares `"dependencies": ["mimo-code"]`, so installing `sprint` auto-installs `mimo-code`. The mimo executor is therefore always available.
- **Codex — optional.** The official Codex plugin [`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc) (`codex@openai-codex`) provides `codex:rescue` + the `codex-companion` runtime. It lives in an external marketplace, so it can't be a hard dependency — it stays a runtime probe.
- **Best with:** [`superpowers`](https://github.com/obra/superpowers-marketplace) for specs & plans (the skill degrades and tells you what's missing).
- A git repository (stages use `git worktree`).

## Usage

| Command | Engine |
| --- | --- |
| `/sprint` | Probe: if codex is present, ask (mimo vs codex); otherwise mimo. |
| `/sprint mimo` | mimo (model resolved per stage). |
| `/sprint codex` | codex. |
| `/sprint mimo <provider/model> [variant]` | mimo, pinned to that model for the whole sprint. |

Describe the milestone after the command. The skill probes capabilities, decomposes the milestone into stages, and drives them.

The mimo model is resolved automatically before every stage (authenticated providers ∩ model catalogue) — unless you pin one with the `<provider/model> [variant]` form, in which case the pinned model is reused for every stage.

[Skill reference →](./skills/sprint/SKILL.md)
