# onsails/cc

Claude Code plugins for power users.

## Plugins

### rust-dev

Strict Rust development standards with FAIL FAST error handling.

- Enforces Edition 2024, proper error propagation
- Workspace templates and dependency version lookup
- rust-builder and review-rust-code agents included
- Module organization guidance (split at 500+ lines)

[Full documentation →](./rust-dev/README.md)

### sprint

Orchestrate one large milestone as staged brainstorm/plan/execute cycles in a living sprint doc.

- Decomposes a multistage milestone into stages; resumes across sessions from the doc
- Per stage: brainstorm spec → write plan → executor implements → `/code-review --fix` → verify → land
- Keeps the main context a lean conductor; runs each stage in an isolated worktree subagent
- Delegates implementation to an **executor**: mimo (hard dependency, always present) or codex (optional)
- Engine chosen by arg (`/sprint mimo|codex`), else asked when codex is present, else mimo; recorded in the sprint doc for resume
- Depends on `mimo-code` (auto-installed); degrades gracefully without `superpowers`/`codex`

[Full documentation →](./sprint/README.md)

### mimo-code

Delegate write-capable coding sessions to the [`mimo` CLI](https://github.com/XiaomiMiMo/MiMo-Code) (Xiaomi's opencode fork), keeping Claude the conductor.

- Offloads implementation to mimo on a chosen `provider/model` + effort
- Runs each session in a sonnet subagent — main context stays lean
- Captures every session id to a parallel-safe file for resume (`--session`, never `--continue`)
- Resolves the model from `mimo models` ∩ authenticated providers and asks you
- Per-handle `O_EXCL` lock keeps concurrent sessions isolated

[Full documentation →](./mimo-code/README.md)

## Installation

```bash
claude plugin marketplace add https://github.com/onsails/cc
claude plugin install rust-dev@onsails-cc
claude plugin install sprint@onsails-cc
claude plugin install mimo-code@onsails-cc
```

Installing `sprint` auto-installs its `mimo-code` dependency. To also use the **codex** engine, install the official Codex plugin from its own marketplace (optional):

```bash
claude plugin marketplace add https://github.com/openai/codex-plugin-cc
claude plugin install codex@openai-codex
```

## License

MIT
