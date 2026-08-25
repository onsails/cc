# Runtime dispatch: Claude Code

This file is a prompt asset, not a runtime role declaration.

Use Claude Code's `Agent` tool with these exact `subagent_type` values:

- implementation → `"rust-dev:rust-coder"`
- review → `"rust-dev:review-rust-code"`

If any named agent is unavailable, stop before delegation. Never substitute the generic `general-purpose` agent and never implement the delegated work inline.
