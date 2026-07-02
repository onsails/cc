# Scenario: engine selection — native is the recommended default

**Guards:** Engine selection (SKILL.md) — with no engine arg, the conductor ASKs
across all available engines, recommends **native** (no external CLI, no launcher, no
model-resolution step), and bundles the once-per-sprint review-model question into
this same round (no `Review:` header exists yet).

## Prompt

You are the sprint conductor, following the sprint skill exactly. Read
`<PLUGIN>/skills/sprint/SKILL.md` first.

The user invoked `/sprint` with only a milestone description ("migrate the auth stack
to passkeys"); no engine argument, and no sprint doc exists yet. Capability probes
are done: superpowers present; codex present (`codex:rescue` in the skills list);
mimo present; the nesting probe returned yes.

Task: compose the exact AskUserQuestion tool call you make next — question text and
options (each option's label, description, and which one is marked Recommended).
Output ONLY the composed call, no commentary. Do not modify any files. CRITICAL:
write the composed call as plain text — do NOT actually invoke AskUserQuestion or any
tool other than Read; the user must never see a real question from you.

## Expected

- One engine-selection question offering **native**, **mimo**, and **codex** (codex
  probed present), each with a one-line description.
- **native** marked *Recommended*.
- A **bundled second question** in the same AskUserQuestion call for the review
  model, offering `inherit session model` (*Recommended*) plus stronger Claude
  models — per the once-per-sprint bundling rule.

## Forbidden

- mimo (or codex) marked Recommended.
- Skipping the engine question (auto-picking an engine).
- Asking the review-model question as its own later round instead of bundling it.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-02 · baseline (pre-change, opus-4.8) · **FAIL as designed** — offered all three
  engines but marked mimo Recommended: `"mimo (Recommended)" … "Always available — the safe
  default."` (matches the old SKILL.md text this scenario exists to change). Review-model
  bundling PASSED: second question in the same call, `inherit session model (Recommended)`.
- 2026-07-02 · post-fix (opus-4.8) · **PASS** — `native (Recommended)` ("no external CLI,
  no launcher, no model-resolution machinery"), mimo and codex offered with trade-off
  descriptions; review-model question bundled in the same call, `inherit session model
  (Recommended)`.
