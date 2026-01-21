---
name: review-loop
description: "ORCHESTRATOR: Run 4 review iterations, invoke /fix skill after each"
---

# Review Loop

Run 4 review iterations. After each review, invoke `/fix` skill to handle findings.

**You are an orchestrator.** You dispatch reviewers and invoke skills. You do NOT fix code.

## Setup

```bash
REVIEW_DIR="/tmp/review-loop-$(date +%s)-$$"
mkdir -p "$REVIEW_DIR"

TARGET_BRANCH=$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || \
  git branch -a --contains HEAD^ --no-contains HEAD | head -1 | tr -d ' ')
```

Create iteration TODOs:

```
TodoWrite([
  {content: "Iteration 1: Review → Fix", status: "in_progress", activeForm: "Running iteration 1"},
  {content: "Iteration 2: Review → Fix", status: "pending", activeForm: "Running iteration 2"},
  {content: "Iteration 3: Review → Fix", status: "pending", activeForm: "Running iteration 3"},
  {content: "Iteration 4: Review → Fix", status: "pending", activeForm: "Running iteration 4"},
])
```

## For Each Iteration (1, 2, 3, 4)

### Step 1: Dispatch reviewer

```
Task(
  subagent_type: "review-loop:local-reviewer"
  description: "Iteration N: Review"
  prompt: "OUTPUT FILE: ${REVIEW_DIR}/iterN.md\nTARGET BRANCH: ${TARGET_BRANCH}"
)
```

### Step 2: Invoke fix skill

```
Skill(skill: "review-loop:fix", args: "${REVIEW_DIR}/iterN.md")
```

The fix skill will:
- Display findings table
- Create fix TODOs
- Dispatch fix subagents
- Report summary

### Step 3: Mark iteration complete

Mark current iteration TODO as `completed`, next as `in_progress`.

## Exit Condition

After iteration 4:
- If no critical/major issues in last review → proceed to Completion
- If critical/major issues remain → continue iteration 5, 6, etc.

## Completion

```bash
git add -A && git commit -m "fix: address code review issues (N iterations)"
```

Report summary. Do NOT merge - wait for user.

## Red Flags

**Never:**
- Fix issues yourself (that's what /fix skill does)
- Read code files (reviewer subagent does that)
- Edit code files (fix subagent does that)
- Skip iterations (must run at least 4)
- Create fix TODOs (that's what /fix skill does)
