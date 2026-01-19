//! Project library crate
//!
//! This is the main library crate containing core functionality.

use thiserror::Error;

/// Main error type for the library
#[derive(Error, Debug)]
pub enum Error {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

/// Result type alias for this library
pub type Result<T> = std::result::Result<T, Error>;

/// Example public API
pub fn example_function() -> Result<String> {
    Ok("Hello, world!".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_example() {
        let result = example_function();
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Hello, world!");
    }
}
