# Common Rust Patterns

This document contains frequently-used Rust patterns and solutions to common problems.

## Dependency Management

### Workspace Dependencies (Rust 1.64+)

Root `Cargo.toml`:
```toml
[workspace]
members = ["project", "project-cli", "project-client"]

[workspace.dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1.40", features = ["full"] }
anyhow = "1.0"
thiserror = "1.0"
```

Member crate `Cargo.toml`:
```toml
[dependencies]
serde = { workspace = true }
tokio = { workspace = true }
```

### Feature Flags

Common patterns:
```toml
[features]
default = ["std"]
std = []
full = ["serde", "tokio"]

[dependencies]
serde = { version = "1.0", optional = true, features = ["derive"] }
tokio = { version = "1.40", optional = true, features = ["full"] }
```

## Error Handling Patterns

### Library Error Type with thiserror

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum MyError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid state: {expected}, got {actual}")]
    InvalidState { expected: String, actual: String },
}

// With backtrace support (nightly or Rust 1.65+)
#[derive(Error, Debug)]
pub enum MyErrorWithBacktrace {
    #[error("Something failed")]
    Failed {
        #[source]
        source: Box<dyn std::error::Error + Send + Sync>,
        backtrace: std::backtrace::Backtrace,
    },
}
```

### Binary/Test Error Handling with anyhow

```rust
use anyhow::{Context, Result};

fn main() -> Result<()> {
    let config = load_config()
        .context("Failed to load configuration")?;

    process_data(&config)
        .context("Failed to process data")?;

    Ok(())
}

fn load_config() -> Result<Config> {
    std::fs::read_to_string("config.toml")
        .context("Failed to read config file")?
        .parse()
        .context("Failed to parse config")
}
```

## Async Patterns

### Tokio Runtime Setup

```rust
// Binary main.rs
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Your async code
    Ok(())
}

// Library with configurable runtime
pub async fn run() -> Result<()> {
    // Async implementation
    Ok(())
}

// Tests
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_async_function() {
        let result = run().await;
        assert!(result.is_ok());
    }
}
```

### Async Trait Methods (requires async-trait before Rust 1.75)

```rust
// Rust 1.75+ (AFIT - Async Functions in Traits)
pub trait AsyncProcessor {
    async fn process(&self, data: &str) -> Result<String>;
}

// Before Rust 1.75, use async-trait crate
use async_trait::async_trait;

#[async_trait]
pub trait AsyncProcessor {
    async fn process(&self, data: &str) -> Result<String>;
}
```

## Lifetime Patterns

### Common Struct Lifetime Patterns

```rust
// Struct borrowing data
pub struct Parser<'a> {
    input: &'a str,
    position: usize,
}

impl<'a> Parser<'a> {
    pub fn new(input: &'a str) -> Self {
        Self { input, position: 0 }
    }

    pub fn parse(&mut self) -> Option<&'a str> {
        // Return borrowed data from input
        Some(&self.input[self.position..])
    }
}

// Multiple lifetimes
pub struct Context<'a, 'b> {
    config: &'a Config,
    data: &'b [u8],
}
```

### Lifetime Elision Rules

```rust
// These are equivalent:
fn process(s: &str) -> &str { s }
fn process<'a>(s: &'a str) -> &'a str { s }

// Explicit lifetime needed when ambiguous:
fn choose<'a>(first: &'a str, second: &'a str, use_first: bool) -> &'a str {
    if use_first { first } else { second }
}
```

## Trait Object Patterns

### Dynamic Dispatch

```rust
// Trait object in parameter
fn process_handler(handler: &dyn Handler) {
    handler.handle();
}

// Boxed trait object (owned)
fn create_handler() -> Box<dyn Handler> {
    Box::new(MyHandler::new())
}

// Trait object with lifetime
fn with_lifetime<'a>(handler: &'a dyn Handler) -> &'a dyn Handler {
    handler
}

// Send + Sync for thread safety
fn create_thread_safe() -> Box<dyn Handler + Send + Sync> {
    Box::new(MyHandler::new())
}
```

## Common Derive Macros

### Standard Derives

```rust
// Basic
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MyStruct {
    field: String,
}

// With serde
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Config {
    #[serde(default)]
    optional_field: Option<String>,

    #[serde(rename = "customName")]
    custom_name: String,
}

// With thiserror
#[derive(thiserror::Error, Debug)]
pub enum MyError {
    #[error("Failed: {0}")]
    Failed(String),
}

// With derive_more
use derive_more::{Display, From, Into};

#[derive(Debug, Display, From, Into)]
pub struct UserId(u64);
```

## Configuration Patterns

### CLI-First Configuration

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

// main.rs
fn main() -> anyhow::Result<()> {
    let args = CliArgs::parse();
    let config = Config::from_cli_args(args);

    // Use config...
    Ok(())
}
```

## Testing Patterns

### Configuration Through Parameters (No env::set_var)

```rust
pub struct Client {
    api_key: String,
    base_url: String,
}

impl Client {
    pub fn new(api_key: String, base_url: String) -> Self {
        Self { api_key, base_url }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client() {
        // Pass test config directly - NO env::set_var!
        let client = Client::new(
            "test-key".to_string(),
            "http://localhost:8080".to_string(),
        );

        // Test with this config
        assert_eq!(client.api_key, "test-key");
    }
}
```

### Test Organization

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // Helper functions
    fn create_test_config() -> Config {
        Config {
            api_key: "test".to_string(),
            base_url: "http://test".to_string(),
        }
    }

    #[test]
    fn test_feature_one() {
        let config = create_test_config();
        // Test code
    }

    #[test]
    fn test_feature_two() {
        let config = create_test_config();
        // Test code
    }
}
```

## Newtype Patterns

### Type Safety with Newtypes

```rust
use derive_more::{Display, From, Into};

// Strong typing for IDs
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Display, From, Into)]
pub struct UserId(u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Display, From, Into)]
pub struct OrderId(u64);

// Now these cannot be confused
fn get_user(id: UserId) -> User { /* ... */ }
fn get_order(id: OrderId) -> Order { /* ... */ }

// Won't compile - type safety!
// get_user(OrderId(123));  // Error!
```

## Builder Pattern

### Simple Builder with derive_builder

```toml
[dependencies]
derive_builder = "0.20"
```

```rust
use derive_builder::Builder;

#[derive(Debug, Builder)]
#[builder(setter(into))]
pub struct Config {
    #[builder(default = "\"localhost\".to_string()")]
    host: String,

    #[builder(default = "8080")]
    port: u16,

    api_key: String,

    #[builder(default)]
    timeout_secs: Option<u64>,
}

// Usage
let config = ConfigBuilder::default()
    .host("example.com")
    .port(9000)
    .api_key("secret")
    .timeout_secs(30)
    .build()?;
```
