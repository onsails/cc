# onsails/cc

Claude Code plugins for power users.

## Plugins

### review-loop

Automated code review and fix loop with per-issue subagents.

- Optional code-simplifier pre-pass (install from [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official))
- Runs minimum 4 review iterations until stable
- Spawns isolated Task agent per issue (preserves main context)
- Auto-discovers project standards: CLAUDE.md, CI configs, linter rules
- Smart target branch detection via PR or git history

[Full documentation →](./review-loop/README.md)

### rust-dev

Strict Rust development standards with FAIL FAST error handling.

- Enforces Edition 2024, proper error propagation
- Workspace templates and dependency version lookup
- rust-builder and review-rust-code agents included
- Module organization guidance (split at 500+ lines)

[Full documentation →](./rust-dev/README.md)

## Installation

```bash
claude plugin marketplace add https://github.com/onsails/cc
claude plugin install review-loop@onsails-cc
claude plugin install rust-dev@onsails-cc
```

## License

MIT
