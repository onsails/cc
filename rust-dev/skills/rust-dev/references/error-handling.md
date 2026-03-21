# Error Handling — FAIL FAST

**The Rule:** Every error MUST propagate up the call stack. The program halts on errors.

## Why

- Silent failures corrupt data and leave systems in undefined states
- Half-completed operations are worse than crashes
- Errors cascade: one swallowed error causes 10 mysterious failures downstream
- Logging without propagating gives false confidence

## Correct — Always propagate

```rust
operation()?;

operation().context("failed during initialization")?;

let result = operation().map_err(|e| {
    tracing::error!("Operation failed: {e}");
    e
})?;

match operation() {
    Ok(val) => process(val),
    Err(e) => return Err(e.into()),
}
```

## Forbidden — These all swallow errors

```rust
if let Err(e) = operation() { log::error!("{e}"); }  // No return!
operation().unwrap_or_default();  // Silent fallback
operation().ok();  // Discards error
let _ = operation();  // Explicitly ignores
return Ok(());  // After catching an error — NEVER
```

**Self-Check:** `if let Err` or `match ... Err` without `return Err` or `?` = bug.

## Library Crates — thiserror with backtrace

```rust
use std::backtrace::Backtrace;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum MyError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error, Backtrace),

    #[error("Parse error: {0}")]
    Parse(String, Backtrace),
}

pub type Result<T> = std::result::Result<T, MyError>;
```

## Binaries — anyhow with context

```rust
use anyhow::{Context, Result};

#[tokio::main]
async fn main() -> Result<()> {
    let config = load_config()
        .context("Failed to load configuration")?;
    Ok(())
}
```

## Preserving Error Chains

Use `.context()` or `.with_context()`. NEVER `anyhow!()` with string formatting.

```rust
// CORRECT — preserves chain
operation().context("failed during init")?;
operation().with_context(|| format!("failed for user {}", user_id))?;

// WRONG — breaks the chain
operation().map_err(|e| anyhow::anyhow!("failed: {}", e))?;
if let Err(e) = operation() {
    bail!("operation failed: {}", e);  // e is formatted away
}
```

With proper chaining, `{:?}` shows the full cause tree:
```
Error: failed during init

Caused by:
    0: network request failed
    1: connection refused (os error 111)
```
