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

Orchestrate one large milestone as staged brainstorm/plan/execute cycles in a living sprint doc. Runs on Claude Code or Oh My Pi (OMP).

- Decomposes a multistage milestone into stages; resumes across sessions from the doc
- Per stage: brainstorm spec → write plan → executor implements → dedicated `sprint-reviewer` gate (resolved review backend axes + risk specialists, fix, re-review) → verify → land
- Keeps the main session a lean conductor; nests each stage through a `sprint-stage-runner` subagent (Claude Code: probed once per sprint; OMP: requires `task.maxRecursionDepth >= 3`) or falls back to one subagent per step
- Delegates implementation to an **executor**: native subagents on Claude Code or OMP (recommended default), plus mimo or codex on Claude Code only
- Engine chosen by arg (`/sprint native|mimo|codex`) or an interactive runtime-supported menu; executor and review models are explicit choices recorded for resume
- Depends on `mimo-code` for the Claude Code mimo engine; OMP currently offers native only. Matt Pocock's `grilling`, `codebase-design`, and `diagnosing-bugs` skills are strongly recommended but optional; sprint retains built-in brainstorming, planning, diagnosis, and runtime-native SDD paths. The stage review gate uses the code review named by the repository's instructions, or the runtime's built-in default: Claude Code's bundled `/code-review` skill, or OMP's built-in `reviewer` agent.

  ```sh
  claude plugin marketplace add mattpocock/skills
  claude plugin install mattpocock-skills@mattpocock
  ```

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
