# Module Organization

## When to Split

1. **File exceeds ~500 lines** with semantically distinct components
2. **Tests take 50%+ of file** — extract to sibling `_tests.rs`
3. **Multiple distinct responsibilities** that can be cleanly separated

## When NOT to Split

- Under 300 lines
- Tightly coupled code (splitting forces excessive `pub` visibility)
- Single responsibility even if long (e.g., complex algorithm)

## Test Extraction — Sibling File (preferred)

```
src/
├── parser.rs           # Implementation only
└── parser_tests.rs     # Tests in sibling file
```

```rust
// parser.rs
pub fn parse(input: &str) -> Result<Ast> { ... }

#[cfg(test)]
#[path = "parser_tests.rs"]
mod tests;
```

## Splitting Implementation Modules

```
// Before: large api.rs with 600+ lines
src/api.rs

// After: api/ directory with focused submodules
src/
└── api/
    ├── mod.rs          # Re-exports public items
    ├── client.rs
    ├── endpoints.rs
    └── types.rs
```

```rust
// api/mod.rs — preserve public API with re-exports
mod client;
mod endpoints;
mod types;

pub use client::ApiClient;
pub use endpoints::{get_user, create_order};
pub use types::{Request, Response};
```

**Key rules:**
1. Use `pub use` re-exports in `mod.rs` to maintain the same public API
2. Keep related code together — don't split tightly coupled code
3. Use `pub(super)` or `pub(crate)` for cross-module access that shouldn't be public
