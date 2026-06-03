# onsails/cc

Claude Code plugins for power users.

## Plugins

### review-loop

Automated code review and fix loop with per-issue subagents.

- Code simplification pre-pass via `simplify` skill
- Runs minimum 4 review iterations until stable
- Spawns isolated Task agent per issue (preserves main context)
- Auto-discovers project standards: CLAUDE.md, CI configs, linter rules
- Smart target branch detection via PR or git history

<img width="804" height="699" alt="Screenshot 2026-01-24 at 15 17 56" src="https://github.com/user-attachments/assets/db1bfd12-a76f-4696-8804-2e48da2a5f57" />

[Full documentation →](./review-loop/README.md)

### rust-dev

Strict Rust development standards with FAIL FAST error handling.

- Enforces Edition 2024, proper error propagation
- Workspace templates and dependency version lookup
- rust-builder and review-rust-code agents included
- Module organization guidance (split at 500+ lines)

[Full documentation →](./rust-dev/README.md)

### codex

Orchestrate OpenAI Codex CLI from Claude Code via tmux.

- Manages Codex in a separate tmux pane for parallel AI work
- Auto-resolves plan references and context into self-contained prompts
- Supervises execution, approves/rejects actions, reviews changes on completion
- Requires tmux session and `codex` CLI in PATH

[Full documentation →](./codex/README.md)

### codex-sprint

Orchestrate one large milestone as staged brainstorm/plan/codex-execute cycles in a living sprint doc.

- Decomposes a multistage milestone into stages; resumes across sessions from the doc
- Per stage: brainstorm spec → write plan → codex implements → `/code-review --fix` → verify → land
- Keeps the main context a lean conductor; runs each stage in an isolated worktree subagent
- Delegates implementation to codex; degrades gracefully without `superpowers`/`codex`

[Full documentation →](./codex-sprint/README.md)

## Installation

```bash
claude plugin marketplace add https://github.com/onsails/cc
claude plugin install review-loop@onsails-cc
claude plugin install rust-dev@onsails-cc
claude plugin install codex@onsails-cc
claude plugin install codex-sprint@onsails-cc
```

## License

MIT
