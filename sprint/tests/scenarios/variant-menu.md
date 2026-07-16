# Scenario: variant menu — low-risk stage

**Guards:** the mimo variant ASK (SKILL.md → Conductor pre-dispatch, *Variant* bullet;
mechanics.md → Effort Scaling). The risk-scaled variant must always be *in the menu*
and marked *Recommended* — including `medium`, which the old wording relegated to
"via Other", making the rule unsatisfiable for low/cosmetic stages.

## Prompt

You are the sprint conductor mid-sprint, following the sprint skill exactly. Read
these two files first:

- `<PLUGIN>/skills/sprint/SKILL.md`
- `<PLUGIN>/skills/sprint/mechanics.md`

Situation: the sprint doc header says `Engine: mimo` (NOT pinned), `Nesting: yes`,
and has no `Review:` line (the review-model question was already asked at engine
selection and answered "inherit" — do not re-ask it). The user declined the offer to
pin model+variant back at stage 1. The current stage is `03-copy-tweaks` — pure
wording/label tweaks across two template files; you judge its risk **low / cosmetic**.
Pre-dispatch you ran mimo-resolve and, with the user, already picked the model
`anthropic/claude-sonnet-5`. The next pre-dispatch step is the **variant** question.

Task: compose exactly one AskUserQuestion tool call for the variant menu — the
question text and the options array (each option's label, description, and which one
is marked Recommended). The composed call is authoritative: every option and the
recommendation must live inside that one call. Brief explanatory prose outside the
call is ignored for grading unless it contradicts the call, adds or alters a
selection or recommendation, claims a variant was auto-selected, substitutes or
defers another call, or obscures a missing required field. Do not compose a second
call. Pseudo-JSON is fine. Do not modify any files. CRITICAL: write the composed call
as plain text — do NOT actually invoke AskUserQuestion or any tool other than Read;
the user must never see a real question from you.
The response must literally contain `AskUserQuestion(` followed by its complete
argument. A JSON object that summarizes or claims a call exists is zero composed
calls and fails.

## Expected

- Exactly one composed AskUserQuestion call; all authoritative question text,
  options, and the recommendation are inside it.
- ≤4 options, each with a one-line description.
- `default` (omit `--variant`) is one of the options.
- `medium` is **in the menu** (not relegated to Other) and marked **Recommended** —
  it is the risk-scaled variant for a low/cosmetic stage per Effort Scaling.

## Forbidden

- Zero or multiple composed AskUserQuestion calls, or an actual AskUserQuestion/tool
  invocation.
- Contradicting the composed call, adding or altering a selection or recommendation
  outside it, claiming a variant was auto-selected, substituting/deferring another
  call, or using outside prose to hide a required field missing from the call.
- `medium` absent from the menu / reachable only via "Other".
- `high` or `max` marked Recommended for a low/cosmetic stage.
- More than 4 options, or auto-picking the variant without asking.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-02 · baseline (pre-fix, opus-4.8) · **behavior PASS, instruction unsatisfiable** —
  the agent composed `default`/`low`/`medium`(Recommended)/`high` with `minimal`/`max` via
  Other, i.e. it put `medium` in the menu and recommended it — but only by overriding the
  skill's literal "`minimal`/`medium` reach via **Other**" clause, which contradicts the
  Effort Scaling table for low/cosmetic stages. A more literal agent would relegate the
  Recommended variant to Other. Also: the agent *actually invoked* AskUserQuestion at the
  real user instead of printing the composed call → prompts now carry an explicit
  no-invocation guard.
- 2026-07-02 · post-fix (opus-4.8) · **PASS** — menu `medium (Recommended)` / `default` /
  `low` / `high`, `minimal`/`max` via Other; followed the new wording directly, no
  override needed.
- 2026-07-02 · post mechanics Effort-Scaling wording alignment (opus) · **PASS** — same
  menu; SKILL.md and mechanics.md no longer disagree.
- 2026-07-11 · post runtime-portability changes (GPT-5.6) · **PASS** — one
  four-option variant question offered `medium (Recommended)`, `default`, `low`,
  and `high`; it neither hid the risk-scaled choice in Other nor auto-selected it.
- 2026-07-12 · post output-shape refinement (Opus) · **PASS** — exactly one composed
  four-option `AskUserQuestion` call offered `medium` (Recommended), `default`, `low`,
  and `high`; no tool was invoked. Its brief prose only restated the call, so it did
  not add, alter, hide, or auto-select a variant.
- 2026-07-16 · post Matt migration (GPT-5.6) · **PASS** — one four-option call
  kept `medium` Recommended and `default` explicit.
- 2026-07-16 · final Claude procedure (`opus`) · **PASS** — one literal composed
  call kept `medium` Recommended with `default`, `low`, and `high`.
