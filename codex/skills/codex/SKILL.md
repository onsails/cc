---
name: codex
description: This skill orchestrates OpenAI Codex CLI from Claude Code via tmux. Use when delegating implementation tasks to Codex, running /codex with a prompt, or when parallel AI assistance in a separate pane is needed. Opens a tmux pane, launches Codex with the specified prompt, supervises execution, approves actions, and reviews changes upon completion.
---

# Codex Orchestration via tmux

Orchestrate OpenAI Codex CLI in a separate tmux pane for parallel AI-assisted development.

## Prerequisites

- Claude Code must be running inside a tmux session
- `codex` CLI must be available in PATH

## Workflow

### 1. Verify tmux Environment

Before proceeding, verify running inside tmux:

```bash
[ -n "$TMUX" ] && echo "Inside tmux" || echo "Not in tmux"
```

If not in tmux, inform the user and abort.

### 2. Prepare the Prompt

The user's prompt may contain references that need evaluation before passing to Codex:

- **Plan references**: If user says "implement this plan", read the plan file and include its contents
- **Context references**: If user references "the function above" or similar, resolve to actual code
- **File references**: If user mentions specific files, verify they exist

Construct a clear, self-contained prompt for Codex that includes all necessary context.

### 3. Manage the Codex Pane

Check for existing Codex pane or create one:

```bash
# List panes and check for one titled "codex"
CODEX_PANE=$(tmux list-panes -F '#{pane_id}:#{pane_title}' | grep ':codex$' | cut -d: -f1 | head -1)

if [ -z "$CODEX_PANE" ]; then
    # Create new pane (horizontal split, 50% height)
    CODEX_PANE=$(tmux split-window -v -P -F '#{pane_id}')
    # Set pane title
    tmux select-pane -t "$CODEX_PANE" -T "codex"
fi
```

### 4. Launch Codex

Send the Codex command to the pane. Required flags:

- `--sandbox danger-full-access` - Full filesystem access (REQUIRED)
- `-C <dir>` - Set working directory to current repo root
- `--full-auto` - Low-friction automatic execution (recommended for supervised use)

```bash
# Get repo root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

# Send command to codex pane
tmux send-keys -t "$CODEX_PANE" "codex --sandbox danger-full-access --full-auto -C '$REPO_ROOT' '$PROMPT'" Enter
```

For complex prompts with special characters, use heredoc:

```bash
tmux send-keys -t "$CODEX_PANE" "codex --sandbox danger-full-access --full-auto -C '$REPO_ROOT' <<'CODEX_PROMPT'
$PROMPT
CODEX_PROMPT" Enter
```

### 5. Supervise Execution

Monitor Codex progress by periodically capturing pane output:

```bash
# Capture last N lines from codex pane
tmux capture-pane -t "$CODEX_PANE" -p -S -50
```

Supervision responsibilities:

- Watch for approval prompts that require user decision
- If Codex asks for approval on a reasonable action, send `y` + Enter
- If action seems destructive or off-track, send `n` + Enter and provide guidance
- If Codex gets stuck, send additional context or clarification

To send input to Codex pane:

```bash
tmux send-keys -t "$CODEX_PANE" "y" Enter
```

### 6. Detect Completion

Codex completion indicators:

- Pane shows shell prompt (Codex exited)
- Output contains "Task completed" or similar completion message
- No activity for extended period with shell prompt visible

To check if Codex is still running:

```bash
# Check if codex process exists in pane
tmux list-panes -t "$CODEX_PANE" -F '#{pane_pid}' | xargs -I{} pgrep -P {} codex
```

### 7. Review Changes

After Codex completes, review all changes made:

```bash
# Show git status
git status

# Show detailed diff
git diff

# Show untracked files
git ls-files --others --exclude-standard
```

Verification checklist:

- [ ] Changes align with original intent/plan
- [ ] No unintended modifications
- [ ] Code compiles/passes linting
- [ ] Tests pass (if applicable)
- [ ] No secrets or credentials committed

If changes are satisfactory, inform user. If issues found, either:

- Fix issues directly
- Instruct Codex to fix via the pane
- Report issues to user for decision

### 8. Cleanup (Optional)

To close the Codex pane when done:

```bash
tmux kill-pane -t "$CODEX_PANE"
```

## Codex CLI Reference

### Interactive Mode (Default)

```bash
codex [PROMPT]                    # Start interactive session
codex -s danger-full-access       # Full disk access
codex --full-auto                 # Auto-approve safe commands
codex -C /path/to/dir             # Set working directory
codex -m <model>                  # Specify model
```

### Non-Interactive Mode

```bash
codex exec [PROMPT]               # Run non-interactively
codex exec --json                 # Output as JSONL events
codex exec -o output.txt          # Save last message to file
```

### Key Flags

| Flag | Description |
|------|-------------|
| `-s, --sandbox <MODE>` | `read-only`, `workspace-write`, `danger-full-access` |
| `-a, --ask-for-approval <POLICY>` | `untrusted`, `on-failure`, `on-request`, `never` |
| `--full-auto` | Alias for `-a on-request --sandbox workspace-write` |
| `--dangerously-bypass-approvals-and-sandbox` | Skip all prompts (DANGEROUS) |
| `-C, --cd <DIR>` | Working directory for Codex |
| `--add-dir <DIR>` | Additional writable directories |

## Example Usage

User: `/codex implement the authentication feature from our plan`

1. Read the plan file (e.g., `PLAN.md` or recent planning discussion)
2. Verify tmux environment
3. Create/reuse Codex pane
4. Launch: `codex --sandbox danger-full-access --full-auto -C /repo "Implement authentication feature: [extracted plan details]"`
5. Monitor progress, approve reasonable actions
6. On completion, run `git diff` and verify changes match plan
7. Report results to user
