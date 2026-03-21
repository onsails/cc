# Dependency Management

## Version Format

Always use `x.x` (major.minor) format: `serde = "1.0"`. This ensures patch compatibility.

Find latest version: `python3 scripts/check_crate_version.py <crate-name>`

## Workspace Dependencies

Root `Cargo.toml`:
```toml
[workspace]
members = ["project", "project-cli"]

[workspace.dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1", features = ["full"] }
anyhow = "1.0"
thiserror = "2.0"
clap = { version = "4.5", features = ["derive"] }
derive_more = { version = "1.0", features = ["full"] }
```

Member crate `Cargo.toml`:
```toml
[dependencies]
serde = { workspace = true }
tokio = { workspace = true }
```

## Feature Flags

```toml
[features]
default = ["std"]
std = []
full = ["serde", "tokio"]

[dependencies]
serde = { version = "1.0", optional = true, features = ["derive"] }
tokio = { version = "1", optional = true, features = ["full"] }
```

## CLI-First Configuration

```rust
use clap::Parser;

#[derive(Parser, Debug)]
#[command(name = "myapp")]
pub struct CliArgs {
    #[arg(long, env = "API_KEY")]
    api_key: String,

    #[arg(long, default_value = "localhost")]
    host: String,

    #[arg(long, default_value_t = 8080)]
    port: u16,
}

pub struct Config {
    pub api_key: String,
    pub host: String,
    pub port: u16,
}

impl Config {
    pub fn from_cli_args(args: CliArgs) -> Self {
        Self {
            api_key: args.api_key,
            host: args.host,
            port: args.port,
        }
    }
}
```

Never use `Default` that reads environment. Always `from_cli_args()`.
