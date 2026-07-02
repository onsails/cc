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

Task: compose the exact AskUserQuestion tool call for the variant menu — the question
text and the options array (each option's label, description, and which one is marked
Recommended). Output ONLY the composed call (pseudo-JSON is fine), no commentary. Do
not modify any files. CRITICAL: write the composed call as plain text — do NOT
actually invoke AskUserQuestion or any tool other than Read; the user must never see
a real question from you.

## Expected

- ≤4 options, each with a one-line description.
- `default` (omit `--variant`) is one of the options.
- `medium` is **in the menu** (not relegated to Other) and marked **Recommended** —
  it is the risk-scaled variant for a low/cosmetic stage per Effort Scaling.

## Forbidden

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
