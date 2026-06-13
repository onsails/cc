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

### codex-sprint

Orchestrate one large milestone as staged brainstorm/plan/codex-execute cycles in a living sprint doc.

- Decomposes a multistage milestone into stages; resumes across sessions from the doc
- Per stage: brainstorm spec → write plan → codex implements → `/code-review --fix` → verify → land
- Keeps the main context a lean conductor; runs each stage in an isolated worktree subagent
- Delegates implementation to codex; degrades gracefully without `superpowers`/`codex`
- Pairs with the official Codex plugin ([`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc), `codex@openai-codex`) for delegated execution

[Full documentation →](./codex-sprint/README.md)

### mimo-code

Delegate write-capable coding sessions to the `mimo` CLI (Xiaomi's opencode fork), keeping Claude the conductor.

- Offloads implementation to mimo on a chosen `provider/model` + effort
- Runs each session in a sonnet subagent — main context stays lean
- Captures every session id to a parallel-safe file for resume (`--session`, never `--continue`)
- Resolves the model from `mimo models` ∩ authenticated providers and asks you
- Per-handle `O_EXCL` lock keeps concurrent sessions isolated

[Full documentation →](./mimo-code/README.md)

## Installation

```bash
claude plugin marketplace add https://github.com/onsails/cc
claude plugin install review-loop@onsails-cc
claude plugin install rust-dev@onsails-cc
claude plugin install codex-sprint@onsails-cc
claude plugin install mimo-code@onsails-cc
```

`codex-sprint` delegates execution to the official Codex plugin — install it from its own marketplace:

```bash
claude plugin marketplace add https://github.com/openai/codex-plugin-cc
claude plugin install codex@openai-codex
```

## License

MIT
