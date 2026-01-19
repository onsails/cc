//! CLI application
//!
//! This is the command-line interface for the project.

use anyhow::{Context, Result};
use clap::Parser;

/// Command-line arguments
#[derive(Parser, Debug)]
#[command(name = "project")]
#[command(about = "Project CLI application")]
struct CliArgs {
    /// Enable verbose logging
    #[arg(short, long)]
    verbose: bool,

    /// Configuration file path
    #[arg(short, long)]
    config: Option<String>,
}

/// Application configuration
struct Config {
    verbose: bool,
    config_path: Option<String>,
}

impl Config {
    /// Create configuration from CLI arguments
    fn from_cli_args(args: CliArgs) -> Self {
        Self {
            verbose: args.verbose,
            config_path: args.config,
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Parse CLI arguments
    let args = CliArgs::parse();

    // Initialize tracing
    let subscriber = tracing_subscriber::fmt()
        .with_max_level(if args.verbose {
            tracing::Level::DEBUG
        } else {
            tracing::Level::INFO
        })
        .finish();
    tracing::subscriber::set_global_default(subscriber)
        .context("Failed to set tracing subscriber")?;

    // Create configuration
    let config = Config::from_cli_args(args);

    // Run the application
    run(config).await?;

    Ok(())
}

async fn run(config: Config) -> Result<()> {
    tracing::info!("Starting application");

    if config.verbose {
        tracing::debug!("Verbose logging enabled");
    }

    if let Some(path) = &config.config_path {
        tracing::info!("Using config file: {}", path);
    }

    // Call library functionality
    let result = project::example_function()
        .context("Failed to run example function")?;

    println!("{}", result);

    Ok(())
}
