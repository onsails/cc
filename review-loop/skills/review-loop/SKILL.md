---
name: review-loop
description: Automated code review and fix loop with minimum 4 iterations, spawning subagents per issue to preserve context
---

# Review Loop

Automated quality gate: review → fix → repeat until code passes (minimum 4 iterations).

## Quick Start

1. Determine target branch (PR base or nearest parent branch)
2. Run 4+ iterations of: review → fix all issues → repeat
3. Exit when iteration >= 4 AND no critical/major issues

## Step 0: Determine Target Branch

```bash
# First: check for PR
gh pr view --json baseRefName 2>/dev/null && exit 0

# Fallback: find nearest parent branch
current=$(git branch --show-current)
for branch in $(git for-each-ref --format='%(refname:short)' refs/heads refs/remotes); do
    [[ "$branch" == "$current" || "$branch" == "origin/$current" ]] && continue
    base=$(git merge-base HEAD "$branch" 2>/dev/null) || continue
    dist=$(git rev-list --count "$base..HEAD")
    echo "$dist $branch"
done | sort -n | head -1 | cut -d' ' -f2
```

## Main Loop

Repeat for each iteration (minimum 4):

### Phase 1: Review

Generate output path and spawn reviewer:

```bash
REVIEW_OUTPUT="/tmp/review-$(date +%s).md"
```

```
Task(
  subagent_type = "review-loop:local-reviewer"
  description = "Iteration N: Review"
  prompt = """
Review current branch.

OUTPUT FILE: ${REVIEW_OUTPUT}
TARGET BRANCH: ${TARGET_BRANCH}

Write findings to OUTPUT FILE using Write tool.
"""
)
```

Read `${REVIEW_OUTPUT}` when Task completes.

### Phase 2: Fix

For each issue, spawn a fix agent:

```
Task(
  subagent_type = "general-purpose"
  description = "Fix: <issue summary>"
  prompt = """
Fix this issue:
- Issue: <description>
- File: <path>:<line>
- Severity: <level>

Make minimal fix. Run tests. Do not fix other issues.
"""
)
```

### Phase 3: Check Exit

- If iteration >= 4 AND no critical/major issues → Exit
- Otherwise → Continue to next iteration

## Completion

Commit all fixes:
```
fix: address code review issues (N iterations)
```

Report results. Do NOT merge - wait for user.
