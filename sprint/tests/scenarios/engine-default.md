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
are done: Matt skills present; codex present (`codex:rescue` in the skills list);
mimo present; the nesting probe returned yes.

Task: compose exactly one AskUserQuestion tool call you make next — question text and
options (each option's label, description, and which one is marked Recommended).
The composed call is authoritative: every choice and recommendation must live inside
that one call. Brief explanatory prose outside the call is ignored for grading unless
it contradicts the call, adds or alters a selection or recommendation, claims a
choice was auto-selected, substitutes or defers another call, or obscures a missing
required field. Do not compose a second call. Do not modify any files. CRITICAL:
write the composed call as plain text — do NOT actually invoke AskUserQuestion or any
tool other than Read; the user must never see a real question from you.
The response must literally contain `AskUserQuestion(` followed by its complete
argument. A JSON object that summarizes or claims a call exists is zero composed
calls and fails.

## Expected

- Exactly one composed AskUserQuestion call; all authoritative question text,
  choices, and recommendations are inside it.
- One engine-selection question offering **native**, **mimo**, and **codex** (codex
  probed present), each with a one-line description.
- **native** marked *Recommended*.
- A **bundled second question** in the same AskUserQuestion call for the review
  model, offering `inherit session model` (*Recommended*) plus stronger Claude
  models — per the once-per-sprint bundling rule.

## Forbidden

- Zero or multiple composed AskUserQuestion calls, or an actual AskUserQuestion/tool
  invocation.
- Contradicting the composed call, adding or altering a selection or recommendation
  outside it, claiming a value was auto-selected, substituting/deferring another
  call, or using outside prose to hide a required field missing from the call.
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
- 2026-07-11 · post runtime-portability changes (GPT-5.6) · **PASS** — one
  `AskUserQuestion` call offered native/mimo/codex with `native (Recommended)` and
  bundled the review-model question with `inherit session model (Recommended)`.
- 2026-07-12 · post output-shape refinement (Opus) · **PASS** — exactly one composed
  `AskUserQuestion` call offered native/mimo/codex with native Recommended and bundled
  the review-model question with inherit Recommended; no tool was invoked. Its brief
  notes only restated the call, so they did not alter any authoritative choice.
- 2026-07-16 · post Matt migration (GPT-5.6) · **PASS** — one bundled question
  offered native/mimo/codex with native Recommended and inherited review Recommended.
- 2026-07-16 · final Claude procedure (`opus`) · **PASS** — one literal composed
  call bundled the native-recommended engine menu and inherited-review default.
