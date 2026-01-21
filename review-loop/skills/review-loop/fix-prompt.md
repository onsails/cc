# Fix Agent Prompt Template

Use this template when dispatching a fix agent. Fill in the bracketed sections.

```
Task tool (general-purpose):
  description: "Fix: [SHORT_SUMMARY]"
  prompt: |
    You are fixing a code review issue.

    ## Issue Details

    **Title:** [ISSUE_TITLE]
    **File:** [FILE_PATH]:[LINE_NUMBER]
    **Severity:** [critical|major|minor]
    **Description:** [FULL_DESCRIPTION from review]

    ## Your Job

    1. Read the file at the specified location
    2. Understand the issue in context
    3. Make the MINIMAL fix to resolve this specific issue
    4. Run relevant tests - fix any failures YOUR change caused
    5. Run linter/clippy if applicable - fix issues in code YOU modified
    6. Verify the fix compiles

    ## Scope Rules

    **In scope (fix these):**
    - The specific issue described above
    - Test failures caused by your fix
    - Linter errors in code you touched

    **Out of scope (DO NOT fix):**
    - Other issues you notice
    - Unrelated code improvements
    - Refactoring beyond minimal fix
    - Adding comments or documentation

    **If fix requires out-of-scope changes:**
    - STOP and report back
    - Explain what's needed and why
    - Do NOT attempt the larger change

    ## Report Format

    When done, report:
    - What you changed (file:line)
    - How you fixed it (1-2 sentences)
    - Test results (pass/fail)
    - Any concerns or blockers
```
