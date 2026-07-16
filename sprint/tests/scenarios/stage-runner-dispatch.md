# Scenario: conductor → stage-runner dispatch (Nesting: yes)

**Guards:** the nested dispatch template (mechanics.md §0) and its input contract
(agents/stage-runner.md → Inputs). The conductor must pass EVERY resolved input —
engine, stage, plan path, review effort, mimo model/variant/bare handle, `sdd`, and
the pinned review model — on one `sprint:sprint-stage-runner` dispatch with **no
model param**. Before the template existed, the contract lived only in the stage-runner's
own system prompt, which the conductor never reads.

## Prompt

You are the sprint conductor, following the sprint skill exactly. Read these two
files first:

- `<PLUGIN>/skills/sprint/SKILL.md`
- `<PLUGIN>/skills/sprint/mechanics.md`

The sprint doc `docs/plans/auth-sprint.md`:

```
# Auth — Sprint
Integration: feat/auth  ·  Base: master
Engine: mimo
Nesting: yes
Review: opus (pinned)
Legend: todo · brainstorming · planned · executing · review · blocked · done

## Stages
1. [done]    Schema — spec:01-schema-spec.md plan:01-schema-plan.md (merged @a1b2c3)
2. [planned] API    — spec:02-api-spec.md plan:02-api-plan.md mimo:api-7f3a
3. [todo]    UI
## Decisions log
## Open questions
```

Pre-dispatch is already complete for stage 2: with the user you picked model
`anthropic/claude-sonnet-5` and variant `high`; the handle on the stage line is the
one you minted; the mimo-SDD probe found mimo's subagent skill AND you judged the
stage's tasks independent (three endpoints in three separate files). You judge stage
risk **normal**.

Task: compose the exact Agent tool call you (the conductor) make next to run stage 2.
Output ONLY the tool call (subagent_type, any params, and the full prompt body), no
commentary. Do not modify any files. CRITICAL: write the composed call as plain text
— do NOT actually invoke the Agent tool or any tool other than Read.

## Expected

- `subagent_type: "sprint:sprint-stage-runner"` — one dispatch for the whole stage.
- **No `model` param** on the dispatch (the stage-runner inherits the main model).
- The prompt body carries ALL of: engine `mimo`; the stage id `02-api` (and/or plan
  path `docs/plans/02-api-plan.md`); review effort `xhigh` (normal risk); model
  `anthropic/claude-sonnet-5`; variant `high`; the **bare** handle `api-7f3a`;
  `sdd: available`; review model `opus` (from the `Review:` pin).

## Forbidden

- Any of the inputs above missing (silent-missing-input failure class).
- A `model` param set on the stage-runner dispatch.
- The handle passed with its prefix (`mimo:api-7f3a`).
- Dispatching `mimo-code:mimo-delegate` (or a review subagent) directly — that is
  flat-mode orchestration; the doc says `Nesting: yes`.
- Omitting the review model or telling the stage-runner to "inherit" despite the pin.

## Log

<!-- date · pre/post change · pass/fail · verbatim failure -->
- 2026-07-02 · baseline (pre-template, opus-4.8) · **PASS** — a fresh conductor assembled the
  full contract from the scattered sources: `sprint:stage-runner`, no `model` param, engine,
  `02-api` + plan path, review effort `xhigh`, model+variant, bare handle `api-7f3a`
  (prefix stripped), the SDD line with its two-gate rationale, and `model: opus` on the §5
  review per the pin. The mechanics §0 template is therefore **not** fixing an observed
  failure; it canonicalizes the contract (drift-resistance, engine-card prep). This scenario
  stays as the regression guard.
- 2026-07-02 · post-template (opus-4.8) · **PASS** — reproduced the §0 template verbatim:
  no `model` field, engine/sprint/S/title, plan path, `review-effort: xhigh`,
  `review-model: opus`, `sdd: available`, `model`+`variant`+bare `handle: api-7f3a`.
  Far terser than the baseline's hand-assembled version — canonicalization worked.
- 2026-07-11 · post clean-cutover naming (GPT-5.6) · **PASS** — dispatched one
  `sprint:sprint-stage-runner` with no outer `model`, and carried the complete
  resolved mimo, review, SDD, plan, repository, and worktree contract in its prompt.
- 2026-07-12 · post model-repin skill changes (Opus) · **PASS** — one `sprint:sprint-stage-runner` call omitted the outer `model` param and carried `engine: mimo`, `stage: 02-api`, `plan: docs/plans/02-api-plan.md`, `review-effort: xhigh`, executor `model: anthropic/claude-sonnet-5`, `variant: high`, bare `handle: api-7f3a`, `sdd: available`, and pinned `review-model: opus`.
- 2026-07-16 · post Matt migration (GPT-5.6) · **PASS** — one model-free
  `sprint:sprint-stage-runner` dispatch carried every resolved stage input.
- 2026-07-16 · final Claude procedure (`opus`) · **PASS** — one model-free named
  runner dispatch preserved every resolved input and bare mimo handle.
