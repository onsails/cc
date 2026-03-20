# Codex CLI Reference

## Interactive Mode (Default)

```bash
codex [PROMPT]                    # Start interactive session
codex -s danger-full-access       # Full disk access
codex --full-auto                 # Auto-approve safe commands
codex -C /path/to/dir             # Set working directory
codex -m <model>                  # Specify model
```

## Non-Interactive Mode

```bash
codex exec [PROMPT]               # Run non-interactively
codex exec --json                 # Output as JSONL events
codex exec -o output.txt          # Save last message to file
```

## Key Flags

| Flag | Description |
|------|-------------|
| `-s, --sandbox <MODE>` | `read-only`, `workspace-write`, `danger-full-access` |
| `-a, --ask-for-approval <POLICY>` | `untrusted`, `on-failure`, `on-request`, `never` |
| `--full-auto` | Alias for `-a on-request --sandbox workspace-write` |
| `--dangerously-bypass-approvals-and-sandbox` | Skip all prompts (DANGEROUS) |
| `-C, --cd <DIR>` | Working directory for Codex |
| `--add-dir <DIR>` | Additional writable directories |
