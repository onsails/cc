---
name: fix
description: "Process review findings: display table, create TODOs, dispatch fix subagents"
---

# Fix Skill

Process review findings and dispatch fix subagents. Invoked by review-loop after each review iteration.

**You are an orchestrator.** You do NOT fix code yourself. You dispatch subagents.

## Input

Receives review output file path as argument: `/fix /tmp/review-loop-xxx/iter1.md`

If no argument provided, look for most recent review file in `/tmp/review-loop-*/`.

## Process

### Step 1: Read and parse findings

```
Read <review-file>
```

Parse each finding for: severity, file:line, description.

### Step 2: Display findings table

Show ALL findings to user:

```
## Findings

| # | Severity | File:Line | Issue | Action |
|---|----------|-----------|-------|--------|
| 1 | critical | foo.rs:42 | SQL injection | FIX |
| 2 | major    | bar.rs:15 | Race condition | FIX |
| 3 | minor    | baz.rs:99 | Unused import | SKIP (trivial) |
| 4 | minor    | qux.rs:10 | Missing log | FIX (important) |
| 5 | suggestion | ... | Refactor idea | NOTE |
```

**Triage rules:**
- **Critical/Major**: FIX (unless FALSE POSITIVE)
- **Minor**: FIX if important, SKIP if trivial
- **Suggestion**: NOTE only
- **FALSE POSITIVE**: SKIP

### Step 3: Create TODOs for issues marked FIX

```
TodoWrite([
  {content: "Dispatch subagent: Fix [major] Race condition in bar.rs", status: "pending", activeForm: "Dispatching fix subagent"},
  {content: "Dispatch subagent: Fix [critical] SQL injection in foo.rs", status: "pending", activeForm: "Dispatching fix subagent"},
  ...
])
```

### Step 4: Execute each TODO by dispatching subagent

For each "Dispatch subagent" TODO:

1. Mark TODO `in_progress`
2. Dispatch subagent using `./fix-prompt.md` template:

```
Task(
  subagent_type: "general-purpose"
  description: "Fix: [SHORT_SUMMARY]"
  prompt: |
    You are fixing a code review issue.

    ## Issue Details
    **Title:** [ISSUE_TITLE]
    **File:** [FILE_PATH]:[LINE_NUMBER]
    **Severity:** [SEVERITY]
    **Description:** [FULL_DESCRIPTION]

    ## Your Job
    1. Read the file at the specified location
    2. Understand the issue in context
    3. Make the MINIMAL fix to resolve this specific issue
    4. Run relevant tests - fix any failures YOUR change caused
    5. Run linter/clippy if applicable
    6. Verify the fix compiles

    ## Scope Rules
    **In scope:** The specific issue, test failures from your fix, linter errors in code you touched
    **Out of scope:** Other issues, refactoring, adding comments

    ## Report Format
    - What you changed (file:line)
    - How you fixed it (1-2 sentences)
    - Test results
)
```

3. Mark TODO `completed` after Task returns

### Step 5: Report summary

```
## Fix Summary

- Issues found: N
- Issues fixed: M
- Skipped: K (with reasons)
```

## Red Flags

**Never:**
- Fix issues yourself (dispatch subagents)
- Read code files to understand issues (subagent does that)
- Edit code files (subagent does that)
- Skip critical/major issues
- Dispatch multiple subagents in parallel (sequential only)
