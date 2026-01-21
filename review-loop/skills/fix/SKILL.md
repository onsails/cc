---
name: fix
description: "Use when review findings need fixing via subagents - invoked by review-loop after each iteration"
---

# Fix Skill

Process review findings and dispatch fix subagents.

## When to Use

- After review-loop dispatches reviewer
- When review output file exists with findings
- Invoked automatically by review-loop skill

**Not for:** Manual fixes, direct code editing, non-review issues.

## Input

Receives review file path: `/fix /tmp/review-loop-xxx/iter1.md`

If no argument, looks for most recent `/tmp/review-loop-*/iter*.md`.

## Process

**Step 1:** Read findings
```
Read <review-file>
```

**Step 2:** Display findings table
```
| # | Severity | File:Line | Issue | Action |
|---|----------|-----------|-------|--------|
| 1 | critical | foo.rs:42 | SQL injection | FIX |
| 2 | major    | bar.rs:15 | Race condition | FIX |
| 3 | minor    | baz.rs:99 | Unused import | SKIP (trivial) |
```

**Triage:** Critical/Major → FIX. Minor → FIX if important. Suggestion → NOTE. FALSE POSITIVE → SKIP.

**Step 3:** Create TODOs
```
TodoWrite([
  {content: "Dispatch subagent: Fix [severity] issue summary", status: "pending", activeForm: "Dispatching fix subagent"},
  ...
])
```

**Step 4:** Execute each TODO

Mark `in_progress`, dispatch:
```
Task(subagent_type: "general-purpose", description: "Fix: [summary]",
     prompt: "Fix [ISSUE] in [FILE]:[LINE]. Minimal fix, run tests, verify compiles.")
```
Mark `completed` after Task returns.

**Step 5:** Report summary
```
## Fix Summary
- Found: N, Fixed: M, Skipped: K
```

## Red Flags

- Fix issues yourself → dispatch subagents
- Read/edit code files → subagents do that
- Skip critical/major issues
- Parallel subagents → sequential only
