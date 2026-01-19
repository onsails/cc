# Rust Workspace Template

This is a template for a Rust workspace following best practices.

## Structure

```
workspace/
├── Cargo.toml          # Workspace root with shared dependencies
├── project/            # Library crate (core functionality)
│   ├── Cargo.toml      # Uses thiserror for errors
│   └── src/
│       └── lib.rs
└── project-cli/        # Binary crate (CLI interface)
    ├── Cargo.toml      # Uses anyhow for errors, clap for CLI
    └── src/
        └── main.rs
```

## Key Features

- **Workspace dependencies**: All common dependencies defined once in root Cargo.toml
- **Edition 2024**: Uses the latest Rust edition
- **Separation of concerns**: Library crate for logic, CLI crate for interface
- **Error handling**: thiserror for library, anyhow for binary
- **CLI-first configuration**: Config flows through CLI args
- **Async support**: tokio runtime pre-configured
- **Logging**: tracing/tracing-subscriber setup

## Usage

1. Copy this template to your project directory
2. Rename `project` and `project-cli` to match your project name
3. Update package names in all Cargo.toml files
4. Update the binary name in `project-cli/Cargo.toml`
5. Start building!

## Building and Running

```bash
# Build the workspace
cargo build

# Run the CLI
cargo run -p project-cli

# Run tests
cargo test

# Run with verbose logging
cargo run -p project-cli -- --verbose
```
