**Step 1:** Run [setup.sh](../skills/review-loop/scripts/setup.sh) to get REVIEW_DIR and TARGET_BRANCH.

Script location: `~/.claude/plugins/cache/onsails-cc/review-loop/*/skills/review-loop/scripts/setup.sh`

**Step 2:** Invoke skill with captured values:

```
Skill(skill: "review-loop:review-loop", args: "REVIEW_DIR=$REVIEW_DIR TARGET_BRANCH=$TARGET_BRANCH")
```

Do NOT run any other git commands.
