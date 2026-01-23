---
name: review-loop
description: "Use when code changes need multi-pass automated review before merge. Requires TaskCreate setup as first action."
---

# Review Loop

## Step 1: Create Tasks (EXECUTE IMMEDIATELY)

**OUTPUT NOW:**
```
Initializing review-loop. Creating 4 iteration tasks with dependencies...
```

**EXECUTE THESE CALLS:**
```
TaskCreate(subject: "Iteration 1: Review changes",
           description: "Review TARGET_BRANCH changes",
           activeForm: "Running iteration 1")
→ Store ID as ITER1

TaskCreate(subject: "Iteration 2: Review changes", ...)
→ Store ID as ITER2
TaskUpdate(taskId: ITER2, addBlockedBy: [ITER1])

TaskCreate(subject: "Iteration 3: Review changes", ...)
→ Store ID as ITER3
TaskUpdate(taskId: ITER3, addBlockedBy: [ITER2])

TaskCreate(subject: "Iteration 4: Review changes", ...)
→ Store ID as ITER4
TaskUpdate(taskId: ITER4, addBlockedBy: [ITER3])

TaskUpdate(taskId: ITER1, status: "in_progress")
```

**CHECKPOINT - OUTPUT NOW:**
```
Tasks created: #[ITER1], #[ITER2], #[ITER3], #[ITER4]
Iteration 2 blocked by: #[ITER1]
Iteration 3 blocked by: #[ITER2]
Iteration 4 blocked by: #[ITER3]
Proceeding to iteration 1...
```

**DO NOT PROCEED UNTIL YOU HAVE OUTPUT THE ABOVE WITH REAL TASK IDS**

---

## Step 2: Get REVIEW_DIR and TARGET_BRANCH

If args provided, use them. Otherwise run setup script:
```
~/.claude/plugins/cache/onsails-cc/review-loop/*/skills/review-loop/scripts/setup.sh
```

---

## Step 3: Run Iterations (REPEAT FOR EACH)

**3a. Check TaskList**
```
TaskList
```
Find first unblocked pending iteration task. If all blocked, WAIT.

**3b. Dispatch reviewer subagent**
```
Task(subagent_type: "review-loop:local-reviewer",
     description: "Iteration N: Review",
     prompt: "OUTPUT: ${REVIEW_DIR}/iterN.md\nTARGET: ${TARGET_BRANCH}")
```

**3c. Invoke /fix skill**

**INLINE CHECKPOINT:** You have findings. You are about to:
- ✓ Invoke /fix skill (CORRECT)
- ✗ Fix issues yourself (VIOLATION)
- ✗ Ask "Would you like me to..." (VIOLATION)
- ✗ Show results and wait (VIOLATION)

If you catch yourself typing "Would you like..." - DELETE IT. Execute /fix NOW.

```
Skill(skill: "review-loop:fix",
      args: "${REVIEW_DIR}/iterN.md NEXT_ITER_TASK_ID=${next_iter_id}")
```

**3d. Complete current iteration task**
```
TaskUpdate(taskId: "${current_iter_id}", status: "completed")
```

**3e. Go to 3a** (check TaskList for next unblocked task)

---

## Step 4: Completion

After 4+ iterations with no critical/major issues:
```bash
git add -A && git commit -m "fix: address code review issues (N iterations)"
```

---

## Self-Correction Protocol

If you catch yourself typing:
- "Would you like me to..."
- "Should I..."
- "Do you want me to..."

**STOP. Delete that text. Replace with:**
```
Continuing autonomously per review-loop skill.
```
Then execute the action.

---

## Reference Material

### Input
- REVIEW_DIR: Directory for review output files
- TARGET_BRANCH: Branch to compare against

### You are an ORCHESTRATOR
You dispatch subagents. You do NOT:
- Read code files
- Edit code files
- Fix issues yourself
- Run git commands (TARGET_BRANCH is provided)

### Iron Rules
1. MINIMUM 4 iterations - no exceptions
2. ONLY use Task and Skill tools on code
3. SEQUENTIAL iterations - never parallel
4. Invoke /fix skill - never fix yourself
5. Check TaskList BEFORE every action

### Rationalization Table

| Excuse | Reality |
|--------|---------|
| "Two iterations is enough" | NO. Minimum 4. Always. |
| "I'll just fix this quickly" | NO. /fix skill dispatches subagents. |
| "Let me check the code first" | NO. Subagents check code. You dispatch. |
| "Would you like me to continue?" | NO. Never ask. Execute the full loop. |
| "Let me show the results first" | NO. Invoke /fix, then continue. |
| "Task is blocked but I can still..." | NO. Blocked means blocked. |

### Red Flags
- Using Read/Edit/Grep on code files
- Fixing issues directly
- Running fewer than 4 iterations
- Asking user permission
- Working on a blocked task
- Skipping TaskList check
