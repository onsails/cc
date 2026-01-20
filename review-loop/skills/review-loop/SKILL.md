---
name: review-loop
description: Automated code review and fix loop with minimum 4 iterations, spawning subagents per issue to preserve context
---

# Review Loop - 4 Mandatory Passes

This skill runs exactly 4 review-fix passes. Each pass is a separate section below.

## Step 0: Determine Target Branch

```bash
# Check for PR first
gh pr view --json baseRefName 2>/dev/null

# If no PR, find nearest parent branch
current=$(git branch --show-current)
for branch in $(git for-each-ref --format='%(refname:short)' refs/heads refs/remotes); do
    [[ "$branch" == "$current" || "$branch" == "origin/$current" ]] && continue
    base=$(git merge-base HEAD "$branch" 2>/dev/null) || continue
    dist=$(git rev-list --count "$base..HEAD")
    echo "$dist $branch"
done | sort -n | head -1 | cut -d' ' -f2
```

Store as TARGET_BRANCH for all iterations.

---

## Iteration 1: First Review Pass

Generate unique output path:
```bash
REVIEW_OUTPUT_1="/tmp/review-iter1-$(date +%s).md"
```

Spawn reviewer:
```
Task(
  subagent_type = "review-loop:local-reviewer"
  description = "Iteration 1: Review"
  prompt = "Review branch. OUTPUT FILE: ${REVIEW_OUTPUT_1}, TARGET BRANCH: ${TARGET_BRANCH}"
)
```

Read output. For each issue, spawn fix agent:
```
Task(subagent_type = "general-purpose", description = "Fix: <issue>", prompt = "Fix: <details>")
```

---

## Iteration 2: Second Review Pass

Generate unique output path:
```bash
REVIEW_OUTPUT_2="/tmp/review-iter2-$(date +%s).md"
```

Spawn reviewer:
```
Task(
  subagent_type = "review-loop:local-reviewer"
  description = "Iteration 2: Review"
  prompt = "Review branch. OUTPUT FILE: ${REVIEW_OUTPUT_2}, TARGET BRANCH: ${TARGET_BRANCH}"
)
```

Read output. For each issue, spawn fix agent.

---

## Iteration 3: Third Review Pass

Generate unique output path:
```bash
REVIEW_OUTPUT_3="/tmp/review-iter3-$(date +%s).md"
```

Spawn reviewer:
```
Task(
  subagent_type = "review-loop:local-reviewer"
  description = "Iteration 3: Review"
  prompt = "Review branch. OUTPUT FILE: ${REVIEW_OUTPUT_3}, TARGET BRANCH: ${TARGET_BRANCH}"
)
```

Read output. For each issue, spawn fix agent.

---

## Iteration 4: Final Review Pass

Generate unique output path:
```bash
REVIEW_OUTPUT_4="/tmp/review-iter4-$(date +%s).md"
```

Spawn reviewer:
```
Task(
  subagent_type = "review-loop:local-reviewer"
  description = "Iteration 4: Final Review"
  prompt = "Review branch. OUTPUT FILE: ${REVIEW_OUTPUT_4}, TARGET BRANCH: ${TARGET_BRANCH}"
)
```

Read output. Fix any remaining critical/major issues.

If critical/major issues remain after iteration 4, continue with iteration 5, 6, etc. until clean.

---

## Completion

After iteration 4+ with no critical/major issues:

```bash
git add -A && git commit -m "fix: address code review issues"
```

Report summary. Do NOT merge - wait for user.
