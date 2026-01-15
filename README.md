# review-loop

Automated code review and fix loop for Claude Code.

## Installation

```bash
claude plugin marketplace add https://github.com/onsails/cc
claude plugin install review-loop@onsails-cc
```

## Usage

```bash
claude /review-loop
```

Or invoke the skill directly in conversation.

## What it does

1. Determines target branch (via PR or git history)
2. Spawns `local-reviewer` agent to find issues
3. Spawns fix agents per issue (preserves context)
4. Loops minimum 4 iterations until stable
5. Commits fixes, awaits user instruction

## License

MIT
