# rust-dev

Strict Rust development standards with FAIL FAST error handling.

## Why This Exists

Claude can write Rust, but without guardrails it produces:
- `unwrap_or_default()` that silently swallows errors
- `if let Err(e) = ... { log::error!() }` without propagation
- Edition 2021 instead of 2024
- Hardcoded dependency versions that rot

This skill enforces standards that prevent subtle bugs from shipping.

## Install

```bash
claude plugin marketplace add https://github.com/onsails/cc
claude plugin install rust-dev@onsails-cc
```

## Usage

Activate automatically when working with Rust code, or invoke explicitly:

```bash
claude /rust-dev
```

## Key Features

**FAIL FAST error handling** - Every error must propagate with `?` or explicit
return. Logging is not handling. `unwrap_or_default()` is forbidden.

**Edition 2024 enforcement** - Always uses the current edition, not legacy 2021.

**Dependency version lookup** - Bundled script queries crates.io for latest
versions. Uses `x.x` format (e.g., `serde = "1.0"`).

**Workspace templates** - Ready-to-use structure: library crate with thiserror,
binary crate with anyhow + clap. Proper separation of concerns.

**Module organization** - Guidance on when to split (500+ lines, 50%+ tests),
with patterns for test extraction to sibling files.

## Included Agents

- **rust-builder** - Runs cargo build/clippy commands
- **review-rust-code** - Reviews Rust code for standards compliance
