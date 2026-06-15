# codex-sprint

Orchestrate one large milestone as a series of **brainstorm → plan → codex-execute** stages, tracked in a living sprint doc, with the implementation delegated to OpenAI Codex while Claude stays the conductor.

> You are the foreman. Codex digs.

## What it's for

A milestone too big for a single spec-and-plan — a long, multistage effort that spans sessions and needs several rounds of brainstorming and planning. Instead of one giant plan, you decompose it into stages and drive them one at a time, resuming across sessions from a persistent doc.

**Use when:**

- A milestone needs *multiple* brainstorm/plan rounds, not one spec → done.
- Work spans sessions and you need to resume "what stage am I on".
- You want to hand the coding to codex while steering design yourself.

**Not for:** a single-spec feature (use `superpowers:brainstorming` → `writing-plans` → execute) or a one-off task (use `codex:rescue` directly).

## How it works

- **Lean conductor.** The main context holds only the sprint doc, current stage, decisions, and open questions. Every technical step runs in an isolated git worktree via a subagent, so diffs and build logs never flood it.
- **Per-stage lifecycle:** brainstorm a spec → write a plan → isolate a worktree → codex implements (`--write`) → headless `/code-review --fix` → verify → commit & land → update the doc.
- **Graceful degradation.** Probes for `superpowers`, the `codex` plugin, and a codex-side subagent-driven-development skill; adapts and recommends installing whatever is missing.
- **Exact commands** (codex invocation, worktree, review, land) live in [`mechanics.md`](./skills/codex-sprint/mechanics.md) alongside the skill.

## Requirements

- **Best with:** [`superpowers`](https://github.com/obra/superpowers-marketplace) (specs & plans) and the official Codex plugin [`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc) (`codex@openai-codex`, provides `codex:rescue` + the `codex-companion` runtime for delegated execution). Both are optional — the skill degrades and tells you what to install.
- A git repository (stages use `git worktree`).

## Usage

Invoke the `codex-sprint` skill and describe the milestone. It will probe capabilities, decompose the milestone into stages, and drive them.

[Skill reference →](./skills/codex-sprint/SKILL.md)
