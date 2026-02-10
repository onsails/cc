#!/usr/bin/env bash
# Review-loop setup script
# Creates session directory and detects target branch
# Usage: source ./setup.sh  OR  eval "$(./setup.sh)"

set -euo pipefail

# Capture repository path (current working directory)
REPO_PATH="$(pwd)"

# Create unique session directory
REVIEW_DIR="/tmp/review-loop-$(date +%s)-$$"
mkdir -p "$REVIEW_DIR"

# Detect target branch
# Priority 1: PR base branch
TARGET_BRANCH=$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || true)

# Priority 2: Nearest parent branch (by commit distance)
if [ -z "$TARGET_BRANCH" ]; then
  current=$(git branch --show-current)
  TARGET_BRANCH=$(
    for branch in $(git for-each-ref --format='%(refname:short)' refs/heads refs/remotes/origin); do
      # Skip current branch and its remote tracking
      [[ "$branch" == "$current" ]] && continue
      [[ "$branch" == "origin/$current" ]] && continue
      [[ "$branch" == "HEAD" ]] && continue
      [[ "$branch" == "origin/HEAD" ]] && continue

      # Get merge-base and calculate distance
      base=$(git merge-base HEAD "$branch" 2>/dev/null) || continue
      distance=$(git rev-list --count "$base..HEAD")
      echo "$distance $branch"
    done | sort -n | head -1 | cut -d' ' -f2-
  )
fi

# Fallback to master/main if nothing found
if [ -z "$TARGET_BRANCH" ]; then
  if git rev-parse --verify origin/main >/dev/null 2>&1; then
    TARGET_BRANCH="origin/main"
  else
    TARGET_BRANCH="origin/master"
  fi
fi

# Output for eval
echo "export REPO_PATH='$REPO_PATH'"
echo "export REVIEW_DIR='$REVIEW_DIR'"
echo "export TARGET_BRANCH='$TARGET_BRANCH'"

# Also print human-readable
>&2 echo "Repository: $REPO_PATH"
>&2 echo "Review session: $REVIEW_DIR"
>&2 echo "Target branch: $TARGET_BRANCH"
