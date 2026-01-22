---
name: fix
description: "Use when review findings need fixing via subagents - invoked by review-loop after each iteration"
---

# Fix Skill

**You DISPATCH subagents to fix issues. You do NOT fix them yourself.**

**Violating the letter of these rules is violating the spirit.**

## When to Use

- Invoked by review-loop after each review iteration
- When review output file exists with findings

**Not for:** Manual fixes, direct code editing.

## The Iron Rules

1. **NEVER use Edit tool** - subagents fix code, not you
2. **NEVER read code files** - only read the review findings file
3. **DISPATCH sequentially** - one subagent at a time, wait for completion
4. **FIX critical/major** - skip only false positives or trivial minors

## Process (EXACT sequence)

**Step 1:** Read ONLY the review findings file
```
Read <review-file>
```

**Step 2:** Display findings table to user
```
| # | Severity | File:Line | Issue | Action |
|---|----------|-----------|-------|--------|
| 1 | critical | foo.rs:42 | SQL injection | FIX |
| 2 | major    | bar.rs:15 | Race condition | FIX |
| 3 | minor    | baz.rs:99 | Unused import | SKIP |
```

**Step 3:** Create one TODO per issue to fix

Read current todo list. Insert fix TODOs after the current `in_progress` iteration and before the next pending iterations. Preserve all existing TODOs (user may have their own).

**Step 4:** For EACH TODO, mark `in_progress` then dispatch:
```
Task(subagent_type: "general-purpose", description: "Fix: [summary]",
     prompt: "Fix [ISSUE] in [FILE]:[LINE]. Minimal change. Run tests. Verify compiles.")
```
WAIT for Task to complete. Mark TODO `completed`. Next TODO.

**Step 5:** Report summary
```
## Fix Summary
- Found: N, Fixed: M, Skipped: K
```

## Rationalization Table

| Excuse | Reality |
|--------|---------|
| "I'll just fix this quickly" | NO. Dispatch subagent. |
| "This is a one-line fix" | NO. Dispatch subagent. |
| "Let me check the code first" | NO. Only read findings file. Subagent checks code. |
| "I can be more efficient" | NO. Follow the process exactly. |
| "Running fixes in parallel" | NO. Sequential only. |
| "This isn't a real issue" | Mark SKIP in table. Don't decide silently. |

## Red Flags - STOP IMMEDIATELY

If you catch yourself doing ANY of these, STOP:

- Using Edit tool
- Using Read on code files (not findings file)
- Fixing issues directly
- Running subagents in parallel
- Skipping issues without marking SKIP in table
- "Adapting" the process

**All of these mean: You are violating the skill. Stop and follow it.**
