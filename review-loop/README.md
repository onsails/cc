# review-loop

Automated code review and fix loop with per-issue subagents.

## Why a Loop?

Single-pass reviews miss issues that only surface after fixes. A fix in file A
might break file B. The loop continues until the codebase stabilizes - minimum
4 iterations, exit only when zero critical/major issues remain.

## Why Subagents?

Fixing 10 issues in the main conversation bloats context and degrades quality.
Each fix runs in an isolated Task agent with fresh context. The main session
stays clean, tracks progress, and coordinates.

## Install

```bash
claude plugin marketplace add https://github.com/onsails/cc
claude plugin install review-loop@onsails-cc
```

## Usage

```bash
claude /review-loop
```

Or mention the skill in conversation.

## Key Features

**Auto-discovery of project standards** - The reviewer discovers and synthesizes:
- CLAUDE.md / AGENTS.md instructions
- CI workflow definitions
- Linter and formatter configs (clippy, eslint, prettier, etc.)

**Smart target branch detection** - Checks for existing PR first, falls back to
git history analysis. Never assumes master/main.

**False positive tracking** - Issues confirmed as intentional get excluded from
future iterations.

**Escalation handling** - Issues requiring architectural decisions get flagged
for human review instead of infinite retry loops.
