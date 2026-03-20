# codex

Orchestrate OpenAI Codex CLI from Claude Code via tmux for parallel AI-assisted development.

## Why This Exists

Sometimes you want Codex working on a task in parallel while Claude Code handles
something else. This skill manages the full lifecycle: opens a tmux pane, launches
Codex with your prompt, supervises execution, approves actions, and reviews changes.

## Prerequisites

- Claude Code must be running inside a **tmux session**
- `codex` CLI must be available in PATH

## Install

```bash
claude plugin marketplace add https://github.com/onsails/cc
claude plugin install codex@onsails-cc
```

## Usage

```bash
claude /codex implement the auth feature from our plan
```

Or mention the skill in conversation when you want to delegate work to Codex.

## Workflow

1. **Verify tmux** - Checks you're inside a tmux session
2. **Prepare prompt** - Resolves plan references, context, file paths into a self-contained prompt
3. **Manage pane** - Creates or reuses a tmux pane titled "codex"
4. **Launch Codex** - Runs with `--sandbox danger-full-access --full-auto` in the repo root
5. **Supervise** - Monitors output, approves reasonable actions, rejects destructive ones
6. **Detect completion** - Watches for shell prompt or completion messages
7. **Review changes** - Runs `git diff`, verifies alignment with intent, checks for issues
8. **Cleanup** - Optionally closes the Codex pane

## Key Flags

| Flag | Description |
|------|-------------|
| `--sandbox danger-full-access` | Full filesystem access (required) |
| `--full-auto` | Auto-approve safe commands |
| `-C <dir>` | Set working directory |
| `--dangerously-bypass-approvals-and-sandbox` | Skip all prompts (dangerous) |
