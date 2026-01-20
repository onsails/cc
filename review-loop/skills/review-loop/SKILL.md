---
name: review-loop
description: Run exactly 4 review-fix iterations using subagents
---

# Review Loop Checklist

Execute these steps IN ORDER. Do not skip steps.

## Setup

1. Determine TARGET_BRANCH:
   ```bash
   gh pr view --json baseRefName 2>/dev/null || git log --oneline --all --ancestry-path HEAD^..HEAD | head -1
   ```

## Iteration 1

2. Create `/tmp/review-1.md`
3. `Task(subagent_type="review-loop:local-reviewer", prompt="OUTPUT FILE: /tmp/review-1.md, TARGET BRANCH: ${TARGET_BRANCH}")`
4. Read `/tmp/review-1.md`
5. For each issue: `Task(subagent_type="general-purpose", prompt="Fix: ...")`

## Iteration 2

6. Create `/tmp/review-2.md`
7. `Task(subagent_type="review-loop:local-reviewer", prompt="OUTPUT FILE: /tmp/review-2.md, TARGET BRANCH: ${TARGET_BRANCH}")`
8. Read `/tmp/review-2.md`
9. For each issue: `Task(subagent_type="general-purpose", prompt="Fix: ...")`

## Iteration 3

10. Create `/tmp/review-3.md`
11. `Task(subagent_type="review-loop:local-reviewer", prompt="OUTPUT FILE: /tmp/review-3.md, TARGET BRANCH: ${TARGET_BRANCH}")`
12. Read `/tmp/review-3.md`
13. For each issue: `Task(subagent_type="general-purpose", prompt="Fix: ...")`

## Iteration 4

14. Create `/tmp/review-4.md`
15. `Task(subagent_type="review-loop:local-reviewer", prompt="OUTPUT FILE: /tmp/review-4.md, TARGET BRANCH: ${TARGET_BRANCH}")`
16. Read `/tmp/review-4.md`
17. For each issue: `Task(subagent_type="general-purpose", prompt="Fix: ...")`

## Completion

18. If critical/major issues remain, continue to iteration 5
19. Otherwise: `git add -A && git commit -m "fix: review issues"`
20. Report summary. Do NOT merge.
