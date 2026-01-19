---
name: review-loop
description: Automated code review and fix loop with minimum 4 iterations, spawning subagents per issue to preserve context
---

# ⚠️ STOP - EXECUTE THIS FIRST ⚠️

## FIRST ACTION: Create Iteration TODOs NOW

**Before doing ANYTHING else, call TodoWrite with exactly this:**

```json
{
  "todos": [
    {"content": "Iteration 1: Review and fix cycle", "status": "in_progress", "activeForm": "Running iteration 1"},
    {"content": "Iteration 2: Review and fix cycle", "status": "pending", "activeForm": "Running iteration 2"},
    {"content": "Iteration 3: Review and fix cycle", "status": "pending", "activeForm": "Running iteration 3"},
    {"content": "Iteration 4: Review and fix cycle", "status": "pending", "activeForm": "Running iteration 4"}
  ]
}
```

**Do this NOW. Do not read further until you have created these TODOs.**

---

## This is an AUTOMATED LOOP - Minimum 4 Iterations

```
┌─────────────────────────────────────────────────────────────────┐
│  ITERATION 1 → ITERATION 2 → ITERATION 3 → ITERATION 4 → ...   │
│                                                                 │
│  Each iteration: Review → Fix ALL issues → Check → repeat      │
└─────────────────────────────────────────────────────────────────┘
```

## ⛔ FORBIDDEN BEHAVIORS

1. **Do NOT ask "Would you like me to fix these?"** - Just fix them.
2. **Do NOT ask "Should I proceed?"** - Just proceed.
3. **Do NOT ask "Which issues should I address?"** - Address ALL of them.
4. **Do NOT offer options** - This is automated, not interactive.
5. **Do NOT create generic TODOs** - Only "Iteration N" TODOs at top level.
6. **Do NOT skip creating iteration TODOs** - They are MANDATORY.

**Wrong TODO structure:**
```
☐ Spawn local-reviewer subagent     ← WRONG
☐ Review findings                   ← WRONG
☐ Fix issues                        ← WRONG
```

**Correct TODO structure:**
```
☐ Iteration 1: Review and fix cycle  ← CORRECT
☐ Iteration 2: Review and fix cycle  ← CORRECT
☐ Iteration 3: Review and fix cycle  ← CORRECT
☐ Iteration 4: Review and fix cycle  ← CORRECT
```

## ⛔ NEVER Background the Reviewer

**DO NOT use `run_in_background: true` for the reviewer agent.**

If you background the reviewer and poll the output file, you:
- ❌ Waste main context (the thing we're trying to save)
- ❌ Defeat the entire purpose of this skill
- ❌ Force the user to restart the session

**The Task tool blocks by default. LET IT BLOCK. This is correct.**

The reviewer runs in isolated context. When it returns, you get results in one clean message.

---

## Purpose

Automated quality gate: review → fix → verify loop until code passes.
Each fix runs in a separate Task agent to preserve main conversation context.

## Prerequisites

- On a feature branch with changes to review
- Target branch determinable (via PR or git history)

## Workflow

### Step 0: Determine Target Branch (REQUIRED FIRST)

**This step MUST complete before anything else. Do NOT assume master/main.**

#### Priority 1: Check for existing PR

```bash
gh pr view --json baseRefName,number 2>/dev/null
```

- If command succeeds and returns JSON → extract `baseRefName` → this is your target branch
- Report: "Target branch: `<baseRefName>` (via PR #`<number>`)"
- **STOP branch detection here if PR exists**

#### Priority 2: Git history analysis (only if no PR)

```bash
current_branch=$(git branch --show-current)
best_branch=""
best_distance=999999

# Check ALL branches (local AND remote)
for branch in $(git branch --format='%(refname:short)' | grep -v "^${current_branch}$") \
              $(git branch -r --format='%(refname:short)' | grep -v '/HEAD$'); do

    [[ "$branch" == "origin/${current_branch}" ]] && continue

    merge_base=$(git merge-base HEAD "$branch" 2>/dev/null) || continue
    [ -z "$merge_base" ] && continue

    distance=$(git rev-list --count "${merge_base}..HEAD")

    if [ "$distance" -lt "$best_distance" ]; then
        best_distance=$distance
        best_branch=$branch
    fi
done

echo "Target branch: $best_branch (forked $best_distance commits ago)"
```

- The branch with fewest commits between merge-base and HEAD is the target
- Prefer intermediate branches (like `nodesource`) over `master`
- Only fall back to master/main if NO other branch qualifies

#### Store the result

Save `TARGET_BRANCH` for use throughout the workflow. All subsequent steps use this value.

**Anti-pattern:** Do NOT run `git log master..HEAD` or similar before completing this step.

### Initialize Tracking Lists

```
false_positives = []    # Issues confirmed as not real problems
escalated_issues = []   # Issues requiring human decision, skip in future iterations
```

These persist across all iterations of the review loop.

---

### Iteration Rules

- **Minimum**: 4 iterations (continue even if no issues found early)
- **Exit when**: iteration >= 4 AND zero critical/major issues
- Minor issues and suggestions don't block exit after iteration 4
- **No maximum**: continue beyond 4 only if critical or major issues persist

### Main Loop

**At the START of each iteration, IMMEDIATELY create a TODO:**

```
TodoWrite([
  ...existing_todos,
  { content: "Iteration N: Review and fix cycle", status: "in_progress", activeForm: "Running iteration N" }
])
```

**Loop structure:**

```
iteration = 0

REPEAT:
    iteration += 1

    → CREATE TODO: "Iteration N: Review and fix cycle" (in_progress)
    → Phase 1: Review (BLOCKING - no background!)
    → Phase 2: Fix issues (if any)
    → Phase 3: Check exit condition
    → MARK TODO completed with summary

    IF iteration >= 4 AND no critical/major issues:
        EXIT (minor/suggestions allowed)
    ELSE:
        CONTINUE to iteration N+1
```

---

## Phase 1: Review

### Step 1a: Generate unique output path

Before spawning the reviewer, generate a unique file path:

```bash
REVIEW_OUTPUT="/tmp/review-loop-$(git rev-parse --short HEAD)-iter${iteration}-$(date +%s).md"
echo "Review output will be written to: ${REVIEW_OUTPUT}"
```

Store this path - you'll need it for the prompt and for reading results.

### Step 1b: Spawn reviewer (BLOCKING)

**⚠️ STOP. READ THIS BEFORE CALLING Task TOOL.**

You MUST call the Task tool with EXACTLY these parameters:

```
Task(
  subagent_type = "review-loop:local-reviewer"
  description = "Iteration N: Review"
  run_in_background = false   ← MANDATORY. If you set true, you break the skill.
  prompt = <see below, include OUTPUT_FILE path>
)
```

**run_in_background MUST BE false.**
**DO NOT set run_in_background to true.**
**DO NOT omit run_in_background (defaults may vary).**
**EXPLICITLY SET run_in_background = false.**

If you background this agent and poll, you are violating this skill.

**Prompt template (include OUTPUT_FILE from Step 1a):**

```
Perform a local code review of the current branch.

OUTPUT FILE: <REVIEW_OUTPUT path from Step 1a>
Write your findings to this file using the Write tool. Do NOT return findings in your response.

TARGET BRANCH: <TARGET_BRANCH from Step 0>

Use this target branch for the diff - it was determined via:
- PR #<number> (if PR exists), OR
- Git history analysis (branch we forked from most recently)

Do NOT re-determine the target branch. Use the one specified above.

KNOWN FALSE POSITIVES (do not report these again):
<for each item in false_positives>
- `<file>:<line>` - "<description>" - Reason: <reason>
</for each>
(or "None" if list is empty)

ESCALATED (skip, already flagged for human review):
<for each item in escalated_issues>
- `<file>:<line>` - "<description>" - Reason: <reason>
</for each>
(or "None" if list is empty)

Severity levels:
- critical: Security vulnerabilities, data loss risks, crashes
- major: Logic errors, broken functionality, performance issues
- minor: Code style, minor bugs, inconsistencies
- suggestion: Improvements, refactoring opportunities
```

### Step 1c: Read review output

After Task completes, read the output file ONCE:

```bash
cat ${REVIEW_OUTPUT}
```

Parse each issue for:
- Description
- File path and line number
- Severity (critical, major, minor, suggestion)

### REQUIRED: Display Issues Before Fixing

**You MUST display all issues to the user before proceeding to Phase 2.**

Format:

```
## Review Iteration N - Found X issues

### Critical (0)
(none)

### Major (2)
1. **Missing error handling in snapshot recovery** - `crates/hl-ingestor/src/snapshot_consumer.rs:145`
   The recovery function doesn't handle the case where...

2. **Race condition in NATS reconnect** - `crates/hl-sidecar/src/nats.rs:89`
   When connection drops during publish...

### Minor (2)
1. **Unused import** - `crates/hl-ingestor/src/lib.rs:12`
   `std::sync::Arc` is imported but never used

2. **Inconsistent error message** - `crates/hl-sidecar/src/handlers.rs:67`
   Error says "failed to connect" but actual error is timeout

### Suggestions (1)
1. **Consider using `?` operator** - `crates/hl-ingestor/src/main.rs:34`
   The match block could be simplified...
```

**Do NOT proceed to Phase 2 until issues are displayed.**
This ensures the user can see what's being fixed and can interrupt if needed.

**After displaying issues, IMMEDIATELY proceed to Phase 2. Do NOT:**
- Ask "Would you like me to fix these?"
- Ask "Should I proceed?"
- Wait for user confirmation

This is an AUTOMATED loop. The user invoked the skill knowing it will fix issues automatically.
If they want to stop, they will interrupt (Ctrl+C).

**Exception:** If issues hit scope boundaries during fixing (Step 2c-escalation), DO ask user how to proceed with those specific escalated issues.

---

## Phase 2: Fix Issues

**CRITICAL: Do NOT fix issues inline. Spawn a Task agent for EACH issue.**

### Why Subagents?

- Preserves main conversation context
- Each fix has isolated, fresh context
- Prevents token bloat from accumulating fixes

### Sequential Execution

For EACH issue from the review, in order:

#### Step 2a: Track with TODO

```
TodoWrite: Add todo with status "in_progress"
Content: "Fix [<severity>]: <issue summary>"
```

Examples:
- `Fix [critical]: SQL injection in user query`
- `Fix [major]: Missing null check in auth handler`
- `Fix [minor]: Unused import in lib.rs`

#### Step 2b: Spawn Fix Agent

**YOU MUST use the Task tool with these exact parameters:**

| Parameter | Value |
|-----------|-------|
| `subagent_type` | `general-purpose` |
| `description` | `Fix: <short issue summary>` |
| `prompt` | See template below |

**Prompt template:**

```
Fix this code review issue:

**Issue:** <full description from review>
**File:** <file path>:<line number>
**Severity:** <critical|major|minor>

Instructions:
1. Read the specified file
2. Locate the issue at the given line
3. Make the MINIMAL fix to resolve this specific issue
4. Run relevant tests for the modified code - fix any failures caused by your change
5. Run linter/clippy if applicable - fix any issues in code you modified
6. Verify the fix compiles/passes syntax check

SCOPE BOUNDARY:
- If tests fail due to your change → fix them (in scope)
- If linter complains about your change → fix it (in scope)
- If fixing requires changes to unrelated files → STOP and report back
- If the fix snowballs into larger refactoring → STOP and report back
- If you discover the issue requires architectural changes → STOP and report back

When stopping due to scope boundary:
- Do NOT attempt the out-of-scope fix
- Return a clear description of what's needed
- The main session will handle it or consult the user

CONSTRAINTS - Do NOT:
- Fix other issues you may notice
- Refactor surrounding code beyond what's needed for this fix
- Add comments or documentation
- Modify unrelated files
- Commit changes

Return a brief summary of what you changed, or if stopped due to scope boundary, explain why.
```

#### Step 2c: Wait for Completion and Check Result

The Task tool blocks by default. Wait for the agent to complete.

**Check the agent's response:**
- If fix was successful → proceed to Step 2d
- If agent reports "scope boundary" / "out of scope" → handle escalation (see below)

#### Step 2c-escalation: Handle Scope Boundary

If the fix agent reports it hit a scope boundary:

1. **Do NOT retry the same fix** - the agent already determined it's out of scope
2. **Log the issue** - add to a list of "escalated issues"
3. **Continue with remaining issues** - don't block the loop
4. **After the loop iteration completes**, report escalated issues to user:
   ```
   ## Escalated Issues (require manual review)

   The following issues could not be auto-fixed due to scope:
   - Issue: <description>
     Reason: <why it was escalated>
     Agent recommendation: <what the agent suggested>
   ```
5. **Ask user** how to proceed with escalated issues before continuing

#### Step 2d: Mark TODO Complete

```
TodoWrite: Update todo status to "completed"
```

#### Step 2e: Next Issue

Proceed to the next issue. Do NOT parallelize - sequential execution ensures each fix sees previous changes.

#### Step 2f: Handle False Positive Feedback

If during fix attempt the fix agent reports:
- "This is not actually an issue because..." → Add to `false_positives` list
- "This is intentional behavior because..." → Add to `false_positives` list
- "This requires architectural decision..." → Add to `escalated_issues` list

Format for tracking:
```
{
  file: "src/lib.rs",
  line: 45,
  description: "Missing error handling",
  reason: "Intentional panic for invariant violation"
}
```

---

## Phase 3: Check Exit Condition

After all fixes in this iteration:

**Exit condition (ALL must be true):**
1. `iteration >= 4`
2. Last review produced zero **critical** or **major** issues

**Minor issues and suggestions do NOT block exit after iteration 4.**

**Decision table:**

| Iteration | Critical/Major | Minor/Suggestions | Action |
|-----------|----------------|-------------------|--------|
| < 4       | any            | any               | Continue to next iteration |
| >= 4      | > 0            | any               | Continue to next iteration |
| >= 4      | 0              | any               | EXIT - proceed to Completion |

**If exit condition NOT met:** Return to Phase 1 for next iteration.

**If exit condition met:** Proceed to Completion.

---

## Completion

### Step 1: Commit Changes

Commit all accumulated fixes with a descriptive message:

```
fix: address code review issues

Resolved N issues across M iterations of automated review.
```

### Step 2: Report Results

```
## Review Loop Complete

- **Iterations:** N
- **Issues fixed:** X
- **Final status:** All critical/major/minor issues resolved

Awaiting further instructions (not merging automatically).
```

### Step 3: STOP

**Do NOT merge the branch.** Wait for user instructions.

---

## Anti-Patterns (DO NOT DO THESE)

1. **Assuming master/main** - NEVER assume the target branch is master or main. ALWAYS run Step 0 first to determine it via PR or git history.

2. **Skipping PR check** - ALWAYS check `gh pr view` first. If a PR exists, its base branch is authoritative.

3. **Running git commands against master before Step 0** - Do NOT run `git log master..HEAD` or `git diff master` until you've determined the actual target branch.

4. **Fixing inline** - NEVER fix issues in the main conversation. ALWAYS spawn Task agents.

5. **Batching fixes** - NEVER spawn one agent to "fix all issues". ONE agent per ONE issue.

6. **Parallelizing** - NEVER spawn multiple fix agents simultaneously. Sequential only.

7. **Early exit** - NEVER exit before iteration 4, even if no issues found.

8. **Skipping Task tool** - The literal Task tool must be invoked. "Acting as a subagent" doesn't count.

9. **Auto-merging** - NEVER merge after completion. Wait for user.

10. **Hiding issues** - NEVER say "found N issues, fixing them" without showing WHAT the issues are. Display full issue list before fixing.

11. **Backgrounding and polling** - NEVER run reviewer with `run_in_background: true` then poll the output file. This wastes main context - the exact thing we're trying to save. Let the Task block; the reviewer's work happens in isolated context. Blocking is correct.

12. **Skipping iteration TODOs** - NEVER skip creating "Iteration N: Review and fix cycle" TODOs. The user needs to see iteration progress. Create the TODO at the START of each iteration, mark completed at the END.

13. **Generic one-shot TODOs** - NEVER create generic TODOs like "Run review" or "Fix issues". Each TODO must include the iteration number: "Iteration 1: ...", "Iteration 2: ...", etc.

14. **Asking for permission to fix** - NEVER ask "Would you like me to fix these?" or "Should I proceed?" for normal issues. This is an AUTOMATED loop. After displaying issues, IMMEDIATELY start fixing. The user will Ctrl+C if they want to stop. **Exception:** DO ask user about escalated issues (scope boundary hits) - see Step 2c-escalation.

---

## Troubleshooting

**Issue:** Fixes cause new issues
**Solution:** This is expected. The loop continues until stable.

**Issue:** Same issue keeps appearing
**Solution:** After 3 failed attempts at the same issue, flag it for human review and continue with other issues.

**Issue:** Review finds 20+ issues
**Solution:** Fix all of them sequentially. The subagent approach prevents context bloat.

---

## Final Checklist (verify before each action)

Before spawning reviewer:
- [ ] Did I create "Iteration N" TODO?
- [ ] Am I using `run_in_background: false`?
- [ ] Am I letting the Task block (not polling)?

Before moving to next iteration:
- [ ] Did I display all issues to user?
- [ ] Did I mark iteration TODO complete?
- [ ] Is iteration count < 4 OR are there critical/major issues? → Continue
- [ ] Is iteration count >= 4 AND no critical/major issues? → Exit to Completion
