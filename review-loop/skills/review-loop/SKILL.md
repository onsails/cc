---
name: review-loop
description: Run exactly 4 review-fix iterations using subagents
---

# Review Loop Checklist

Execute these steps IN ORDER. Do not skip steps.

## Setup

1. Create session directory and determine target:
   ```bash
   REVIEW_DIR="/tmp/review-loop-$(date +%s)-$$"
   mkdir -p "$REVIEW_DIR"
   echo "Session dir: $REVIEW_DIR"

   # Target branch
   gh pr view --json baseRefName -q .baseRefName 2>/dev/null || \
     git branch -a --contains HEAD^ --no-contains HEAD | head -1 | tr -d ' '
   ```
   Store REVIEW_DIR and TARGET_BRANCH.

## Iteration 1

2. `Task(subagent_type="review-loop:local-reviewer", prompt="OUTPUT FILE: ${REVIEW_DIR}/iter1.md, TARGET BRANCH: ${TARGET_BRANCH}")`
3. `Read ${REVIEW_DIR}/iter1.md`
4. For each issue: `Task(subagent_type="general-purpose", prompt="Fix: ...")`

## Iteration 2

5. `Task(subagent_type="review-loop:local-reviewer", prompt="OUTPUT FILE: ${REVIEW_DIR}/iter2.md, TARGET BRANCH: ${TARGET_BRANCH}")`
6. `Read ${REVIEW_DIR}/iter2.md`
7. For each issue: `Task(subagent_type="general-purpose", prompt="Fix: ...")`

## Iteration 3

8. `Task(subagent_type="review-loop:local-reviewer", prompt="OUTPUT FILE: ${REVIEW_DIR}/iter3.md, TARGET BRANCH: ${TARGET_BRANCH}")`
9. `Read ${REVIEW_DIR}/iter3.md`
10. For each issue: `Task(subagent_type="general-purpose", prompt="Fix: ...")`

## Iteration 4

11. `Task(subagent_type="review-loop:local-reviewer", prompt="OUTPUT FILE: ${REVIEW_DIR}/iter4.md, TARGET BRANCH: ${TARGET_BRANCH}")`
12. `Read ${REVIEW_DIR}/iter4.md`
13. For each issue: `Task(subagent_type="general-purpose", prompt="Fix: ...")`

## Completion

14. If critical/major issues remain, continue to iteration 5
15. Otherwise: `git add -A && git commit -m "fix: review issues"`
16. Report summary. Do NOT merge.
