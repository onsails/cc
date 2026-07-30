# Runtime dispatch: OMP

This file is a prompt asset, not a runtime role declaration.

Use OMP's `task` tool with these exact `agent` values:

- implementation → `"rust-coder"`
- review → `"review-rust-code"`
- build → `"rust-builder"`

Supply no model field; let the agent and configured OMP roles resolve the model. Reject namespaced `rust-dev:*` agent names on OMP.

If any named agent is unavailable, stop before delegation. Never substitute the generic `task` agent and never implement the delegated work inline.
