---
name: sprint
description: Use when one milestone is too large for a single spec or plan and needs several brainstorm-and-plan rounds before it ships — a long, multistage effort spanning sessions where the coding is handed off to an executor (codex, mimo, or native Claude subagents) while you stay the conductor. Triggers on "long multistage project", "many brainstorms and plans", "milestone with multiple stages", "resume where I left off", "delegate implementation to codex or mimo or a native subagent".
argument-hint: "[mimo|codex|native] [<provider/model>|<model>] [variant] [milestone description]"
---

# sprint

## Overview

A milestone too big for one spec-and-plan is run as a **sprint**: a series of stages, each one `brainstorm a spec → write a plan → hand the coding to the executor`. One living doc tracks the stages so you can stop and resume across sessions.

**Core principle:** the main context stays a **lean conductor** — only the sprint doc, current stage, decisions, open questions. Every technical step (executor, review, verify, land) runs in a worktree via a subagent, so diffs and logs never reach it. **The same applies to investigation:** when discussion needs noisy diagnosis — debugging, a repro, browser clicks, log-reading — the conductor dispatches `sprint:investigator` (mechanics → *Investigation (spike)*), which generates the noise in isolation and returns a distilled finding; the conductor never does it inline.

**You are the foreman. The executor digs.**

## When to Use

- A milestone needs **multiple** brainstorm/plan rounds, not one spec → done.
- Long, multistage work **spanning sessions**; you resume "what stage am I on".
- You delegate implementation to an **executor** (codex, mimo, or a native subagent) while steering design.

**Not for:** a single-spec feature; one small task (`codex:rescue` directly).

## Invocation arguments

Raw slash-command arguments: `$ARGUMENTS`

Parse them as `[mimo|codex|native] [<provider/model>|<model>] [variant] [milestone description]` (empty when the skill was triggered by description match rather than `/sprint` — then read intent from the user's message):

- A leading `mimo`, `codex`, or `native` token → the **engine** (see [Engine selection](#engine-selection)).
- A `<provider/model>` token (contains `/`, mimo only) → **pin** that model for the whole sprint; a following `minimal|low|medium|high|max` token → the pinned **variant**. A pin records `Engine: mimo (model: …, variant: …, pinned)` and skips per-stage model resolution.
- For `native`, a following **bare model alias** (no `/`, e.g. `opus`/`sonnet`) → **pin** that model for the whole sprint (records `Engine: native (model: …, pinned)` and skips the per-stage ASK).
- Remaining text → the **milestone description** that seeds the decomposition brainstorm. No description **and** an existing sprint doc → resume at the first non-done stage.

## Capability Probes (run FIRST, every invocation)

Probe; never assume. Adapt, and tell the user to install whatever's missing.

| Capability | Probe | If absent |
|---|---|---|
| superpowers | `superpowers:brainstorming` in skills list? | bare brainstorm + plan; **recommend installing superpowers** |
| executor: codex | `codex:rescue` in skills list? | not required — codex is optional; mimo is the dependency-guaranteed default |
| executor: mimo | `mimo-code:mimo-delegate` available? (hard dependency — should always be true) | if absent, the dependency failed to install — tell the user to reinstall sprint |
| executor: native | none — Claude is the runtime | always available; no external CLI, no probe, no model-resolution step (the conductor knows the models from context and ASKs per stage) |
| executor SDD: codex | *(engine=codex)* `fd -t d subagent-driven-development ~/.codex/skills ~/.claude/plugins/marketplaces/openai-codex 2>/dev/null` | found **AND tasks independent** (§4c) → append `Use subagent-driven-development.` to the codex prompt (§4a); coupled/single-file or absent → hand codex the whole plan |
| executor SDD: mimo | *(engine=mimo)* `find "${XDG_DATA_HOME:-$HOME/.local/share}/mimocode" -path '*/skills/subagent/SKILL.md' 2>/dev/null` (mimo ships `compose:subagent`, and also loads Claude skills) | found **AND tasks independent** (§4c) → append the SDD line to the mimo prompt (§4b); coupled/single-file, or absent (e.g. mimo run with `--pure`) → plain plan |
| executor SDD: native | *(engine=native)* `superpowers:subagent-driven-development` in the skills list? | yes **AND** the stage's tasks are independent (distinct files/areas, no shared state, no sequential-TDD coupling) → pass `sdd: available`; skill present but tasks coupled (one file / sequential red→green / shared state) → `sdd: unavailable` **even though the skill exists** (per-stage suitability call — §4c). When `available`, the executor uses SDD **iff it actually holds the `Agent` tool** (nesting may withhold it — §4c), else implements directly; it does **not** re-judge suitability |
| mimo model | *(only if engine=mimo, unless pinned)* dispatch `mimo-code:mimo-resolve` | **ASK the user** unless `options` has exactly one model (then auto-pick) — one provider ≠ one option. >4 models → **narrow provider-first**, never dump the catalogue (see pre-dispatch). |
| **nesting** | dispatch a one-shot `general-purpose` probe subagent, prompt: *"Reply with exactly one word: `Agent` if you have a Task/Agent subagent-dispatch tool, else `NONE`."* | reports `Agent`/`Task` → `Nesting: yes`; `NONE` → `Nesting: no`. Selects the **orchestration mode** (see Dispatch). Run **once per sprint**, persist in the header. (CLI grants subagents `Agent` → yes; Claude Desktop withholds it → no.) |

## Starting a Sprint

1. `mkdir -p docs/plans`.
2. Create the integration branch and stay on it the whole sprint: `git switch -c feat/<sprint>`.
3. **Select the engine** (see below).
4. Brainstorm the **decomposition** with the user → ordered stages → write the sprint doc (record the engine in its header). Then run stages one at a time.

### Engine selection

The executor is **codex**, **mimo**, or **native** (a native Claude `sprint:stage-executor` subagent). **mimo** and **native** are always available (mimo is a hard dependency; native is Claude itself — no external CLI, no probe); **codex** is optional (probe `codex:rescue`).

- **Explicit arg wins.** `/sprint mimo`, `/sprint codex`, or `/sprint native` picks the engine directly. If codex is requested but absent → tell the user to install the codex plugin (or pick mimo/native), then stop.
- **No arg:** `AskUserQuestion` across the available engines — **mimo** and **native** always, plus **codex** if probed. (mimo is still the safe default to recommend.) Don't auto-skip the question: native and mimo are both always present, so there's never a single forced engine.

Record the engine in the sprint-doc header. **The model is stored in the header ONLY when pinned:**

- `Engine: codex`
- `Engine: mimo` — resolve the model **every stage** (the conductor dispatches `mimo-resolve` and ASKs/auto-picks per stage).
- `Engine: mimo (model: <provider/model>, variant: <v>, pinned)` — **only** on an explicit user pin like `/sprint mimo <provider/model> [variant]`; reuse the pinned model+variant every stage.
- `Engine: native` — **ASK the user which Claude model every stage** (the conductor already knows the available models from context — **no resolve probe** — and offers them with the risk-scaled one recommended).
- `Engine: native (model: <model>, pinned)` — **only** on an explicit user pin like `/sprint native <model>`; reuse the pinned model every stage (skips the per-stage ASK).
- `Engine: bare` — last-resort fallback when no executor subagent can be dispatched at all (the stage-runner implements stages itself, mechanics §4d). Normally unreachable; recorded so a resumed bare sprint still has a recognizable header. (Prefer `native` over `bare` whenever a subagent CAN be dispatched — it keeps the orchestrator lean and lets the model scale.)

## The Sprint Doc

Source of truth at `docs/plans/<sprint>-sprint.md`. Re-invoking the skill reads it and resumes at the first non-done stage. Slugs: **`<sprint>`** = milestone slug (e.g. `auth`); **`<NN>-<stage>`** = per-stage prefix (e.g. `01-schema`).

```
# <Milestone> — Sprint
Integration: feat/<sprint>  ·  Base: master
Engine: mimo
Nesting: yes
Legend: todo · brainstorming · planned · executing · review · blocked · done

## Stages
1. [done]      Schema — spec:01-schema-spec.md plan:01-schema-plan.md (merged @a1b2c3)
2. [executing] API    — spec:02-api-spec.md plan:02-api-plan.md wt:.worktrees/02-api mimo:api-7f3a
3. [todo]      UI
## Decisions log
## Open questions
```

Per-stage files: `docs/plans/<NN>-<stage>-spec.md` and `-plan.md` (superpowers convention).

**Resuming:** read the doc → resume at the **first non-done stage** (at its current status). None left → sprint complete, report and stop. No doc → start a sprint.

## Per-Stage Lifecycle

Steps **1–2 are interactive, in the main context**. Steps **3–7 run in a worktree via a subagent**. Step **8 is back in the main context**. **Before running steps 3–7, open `mechanics.md` (this skill directory) — it holds the exact commands and shell variables (`$WT`, `$BR`, `$S`).**

1. **Brainstorm** (main) → `superpowers:brainstorming` (or bare) → `docs/plans/<NN>-<stage>-spec.md`.
2. **Plan** (main) → `superpowers:writing-plans` (or bare) → `docs/plans/<NN>-<stage>-plan.md`.
3. **Isolate** → create the worktree off the integration branch.
4. **Execute** → the executor (codex, mimo, or native — mechanics §4) implements the plan, write-enabled, **in the worktree**. Where the SDD skill is present **and the stage's tasks are independent** (the conductor's per-stage suitability call — coupled/single-file/sequential-TDD stages skip SDD even when the skill exists), the executor is told to use it (codex/mimo run their own subagents; native does only if it holds the `Agent` tool — §4). If it stalls/stops mid-plan, **resume** (never re-run fresh): codex `task --resume-last`; mimo re-dispatch `mimo-delegate` with the recorded `mimo:<handle>`; native re-dispatch `stage-executor` with `mode: resume`, same cwd + model (mechanics §4).
5. **Review** → in a **subagent** that cds into the worktree, invoke the **vendored `code-review` skill** (`<high|xhigh|max> --fix`, effort by stage risk) via the Skill tool — not the GitHub-PR `/code-review` plugin, not `ultra` (mechanics §5); loop unresolved items back to step 4.
6. **Verify** → repo test/build **in the worktree**; on failure, loop back to step 4.
7. **Commit & land** → commit the worktree changes (the executor/review leave them uncommitted), merge the branch into the integration branch, remove the worktree.
8. **Update doc** (main) → stage → `done` + merge SHA; append decisions/questions; commit the doc; next stage.

**Conductor pre-dispatch (engine=mimo, unless pinned):** before the stage executes, the conductor dispatches `mimo-resolve` for the authenticated `options` (+ its recommended model), then picks model+variant **with the user** — never silently. The proactive style, a "low-risk"/"mechanical"/"trivial" stage, cost, or "not wanting to interrupt" are **not** reasons to skip the ASK; the user chose the engine, not the model.

- **Model.** `options` has **exactly one** model → auto-pick (asking is pointless). **≤4** → one `AskUserQuestion` listing them. **>4** (the common real case — a single provider can expose *dozens*) → **narrow, never dump**: first `AskUserQuestion` the **provider** (the authenticated set is small), then a second `AskUserQuestion` of **≤4 models** for that provider — lead with `mimo-resolve`'s recommended id, and rely on the auto-added **Other** free-text for the long tail. Printing the whole catalogue for the user to retype an id verbatim is the anti-pattern this replaces.
- **Variant.** One `AskUserQuestion` with a **≤4 effort menu** — `AskUserQuestion` caps at 4 options, so you **cannot** list all five variants + a default. Offer `default` (omit `--variant`) plus the risk-relevant variants, **each with a one-line description**, and mark the **stage-risk-scaled** one (mechanics Effort Scaling) *Recommended*; `minimal`/`medium` reach via **Other**.
- **Offer to pin (first unpinned stage only).** Right after the first stage's picks, `AskUserQuestion` once: *reuse this model+variant for the remaining stages?* **Yes** → rewrite the header to `Engine: mimo (model: …, variant: …, pinned)` so later stages skip resolve+ASK (still a fresh handle each). This is the discoverable form of the `/sprint mimo <provider/model> <variant>` pin; it turns *2 prompts × N stages* into *2 total* and is still the **user's** explicit choice, not a conductor auto-skip.

Then mint a unique handle `<stage>-<rand4>` and record `mimo:<handle>` on the stage line. Only a **pinned** sprint (`Engine: mimo (… pinned)`) skips resolve+ASK (reuses the pin, still a fresh handle per stage); `Engine: codex` has no model resolution.

**Conductor pre-dispatch (engine=native, unless pinned):** **no resolve probe** — the conductor already knows the available Claude models from context. It **ASKs the user which model** for the stage (`AskUserQuestion`), offering the known models (typically `opus`/`sonnet`) with the **risk-scaled** one *Recommended* (risky/wide blast radius → `opus`; low/normal → `sonnet`), each option carrying a one-line description. The same discipline as mimo applies: a "low-risk"/"mechanical"/"trivial" stage, the proactive style, cost, or "not wanting to interrupt" are **not** reasons to skip the ASK. **Offer to pin (first unpinned stage only):** right after the first pick, `AskUserQuestion` once *reuse this model for the remaining stages?* → **Yes** rewrites the header to `Engine: native (model: …, pinned)`, skipping the per-stage ASK thereafter (still the user's explicit choice). Record the chosen model as `model:<model>` on the stage line (so a resumed stage reuses the same model); there is **no handle** — native has no session id.

**Dispatch (by `Nesting:` header):** steps 3–7 always run in subagents — diffs/logs never reach the conductor.

- **`Nesting: yes` (nested):** the conductor spawns **one** `sprint:stage-runner` (carries the **`Agent` tool**, **no model** → inherits main) that runs steps 3–7 and dispatches the executor (§4) and review (§5) as **nested** subagents, returning a terse report (`landed @sha` / `blocked: <reason>` / files count).
- **`Nesting: no` (flat — Claude Desktop & any runtime that withholds `Agent` from subagents):** a subagent can't dispatch subagents, so the **conductor** orchestrates the stage flat, one level (`main → subagent`): isolate (git) → executor subagent → review subagent → verify subagent → land (git).

**The exact per-mode commands and the flat sub-steps are in `mechanics.md` §0** — open it before steps 3–7. Either way the conductor reads only terse reports and **never runs or monitors the executor** (no launcher calls, no PID/NDJSON/output polling).

**Model policy:** the mimo executor (`mimo-code:mimo-delegate`) is **sonnet**; the native executor (`sprint:stage-executor`) runs at the **conductor-ASKed model** (scaled to stage risk — risky→`opus`). The **review inherits the main/session model** — never set a `model` on the review dispatch, because the review is the quality gate and must run at the main context's model. **Native exception:** if the native executor ran at a model *stronger* than main (e.g. `opus` on a `sonnet` session), dispatch the review at that **executor** model instead of inheriting — the gate must never be weaker than the code it gates. A verify subagent may be `sonnet`. The conductor runs only steps 1–2, the pre-dispatch resolve/ASK, the `Nesting: no` git plumbing (isolate/land), and step 8.

**Isolation invariant (non-negotiable):** stage **code** never touches the main checkout. Every edit, review fix, and the stage commit happen on the **stage branch `$BR` inside the worktree `$WT`**. Stage code reaches the integration branch **only** through the §7 `git merge --no-ff "$BR"`. The stage-runner must **never** edit stage code in the main tree and **never** `git commit` stage code onto the integration or base branch directly — even when it seems faster, even if the worktree step was skipped, even for a "one-line" change. The *only* thing committed directly to the integration branch is the conductor's step-8 sprint-doc bookkeeping. If step 3 can't isolate (integration branch missing, dirty main tree, `git worktree add` fails), **report `blocked` and stop** — never fall back to working in the main tree.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Executor or review run in the main repo, not a worktree | codex: `--cwd "$WT"`. mimo: launched with the worktree as cwd. Review: the nested subagent cds into `$WT` first. All mutate files. |
| Review run inline or as a `claude -p` subprocess instead of a subagent | Step 5 is **mandatory in a nested Agent/Task subagent** (mechanics §5) — keeps diffs/fixes out of the stage-runner's context. |
| One giant spec/plan for the whole milestone | The anti-pattern this skill replaces. Decompose into stages. |
| Conductor debugging / running a repro / driving the browser **inline** during discussion | Noisy investigation pollutes the lean thread (console/network/screenshots/log dumps). Dispatch `sprint:investigator` (mechanics → *Investigation (spike)*); read back only the distilled `finding:`/`evidence:`/`recommendation:`. A single `rg`/one-liner stays inline; multi-step, wall-of-output, or any browser work → delegate. |
| *(nested mode)* Dispatching the stage-runner as `general-purpose` | It lacks the `Agent` tool, so it can't dispatch the executor/review subagents. In `Nesting: yes` mode use `sprint:stage-runner` (has `Agent`, inherits the main model). |
| Using `sprint:stage-runner` when `Nesting: no` | On Desktop (and any runtime that withholds `Agent` from subagents) the stage-runner can't dispatch its nested executor/review — it dies the same way. With `Nesting: no` the **conductor** orchestrates flat (isolate → executor subagent → review subagent → verify subagent → land); never hand the whole stage to one subagent. |
| Running the nesting probe per stage, or assuming a runtime | Probe **once** per sprint, record `Nesting:` in the header, reuse it. Don't hardcode yes/no — CLI and Desktop differ. |
| `fd`-searching for a `/code-review` command | That finds the `claude-plugins-official` **PR** plugin (reviews a GitHub PR via `gh pr comment`, and spawns its own agents — both wrong here). Invoke the **vendored** `code-review` skill via the Skill tool (`<effort> --fix`, in the worktree), and never `ultra` (the only multi-agent/cloud variant). |
| Conductor running or monitoring the executor — calling the launcher, polling mimo's PID / NDJSON / output files | That's the executor subagent's job (`mimo-delegate`, foreground) — nested under the stage-runner when `Nesting: yes`, dispatched directly by the conductor when `Nesting: no`. Either way the conductor only awaits a terse report and never touches executor machinery. A subagent that "keeps yielding" is **not** a licence to take over monitoring in main. |
| Auto-picking the mimo/native model because the stage is "low-risk"/"mechanical" or to avoid interrupting | The user chose the engine, not the model. mimo: auto-pick **only** when `options` has exactly one model. native: **always ASK** which Claude model (offering the risk-scaled default). Proactivity and "right-sizing cost" never override this — only an explicit user pin does. |
| Dumping the whole model catalogue for the user to type an id (the old ">4 → name an id" path) | A real provider can expose *dozens* of models. **Narrow provider-first**: ASK the provider, then ≤4 models for it (recommended id first, **Other** for the tail). Never a wall of ids to retype every stage. |
| Offering all five variants (+ a "default") in one `AskUserQuestion` | `AskUserQuestion` caps at **4** options. Offer a ≤4 effort menu (`default` + risk-relevant variants, one-line descriptions, risk-scaled default *Recommended*); `minimal`/`medium` via **Other**. |
| Re-ASKing model+variant every stage and never offering to pin | After the first unpinned stage's picks, ASK once to reuse them for the rest (rewrites the header to `(… pinned)`). Turns 2×N prompts into 2; the pin is the user's choice, not a conductor auto-skip. |
| *(native)* Implementing the plan inline in the conductor/stage-runner instead of dispatching `sprint:stage-executor` | That's `bare`, not `native`. native dispatches a dedicated executor subagent (at the ASKed model, into `$WT`) so the orchestrator stays lean and the model can scale. Inline = polluted context + no model knob. |
| *(native)* Leaving the review at main when the executor ran a stronger model | If native executor = `opus` on a `sonnet` session, dispatch the review at `opus` too — never gate strong code with a weaker reviewer (Model policy → Native exception). |
| Merging/removing the worktree before committing | The executor and `--fix` leave changes uncommitted — commit first (mechanics §7). |
| Marking a stage `done` before it merged + passed verify | `done` = merged **and** green. |
| Executor stopped/stalled mid-stage → reported `blocked` or re-ran fresh | Resume first: codex `task --resume-last`; mimo re-dispatch `mimo-delegate` with the recorded handle; native re-dispatch `stage-executor` with `mode: resume` (same cwd + model) so it reads the partial worktree diff and finishes the rest (mechanics §4). A blind fresh run loses context / re-does or clobbers the partial edits. |

## Red Flags — STOP

- About to read a full diff in the main context → dispatch a subagent instead.
- About to start coding yourself → that's the executor's job; delegate.
- About to `git add`/`commit` in the main tree or onto the integration/base branch (stage code) → STOP. Stage code commits only on `$BR` inside `$WT`; it reaches the integration branch via §7 `merge --no-ff`. (Only the conductor's doc commit in step 8 goes on the integration branch.)
- About to read mimo's NDJSON/PID or the launcher's output in the main context, or poll a "detached" executor → STOP. The executor runs inside a `mimo-delegate` subagent (foreground); the conductor only awaits a terse report.
- `Nesting: no` and about to hand the whole stage to one `sprint:stage-runner` → STOP. That subagent can't dispatch its nested executor/review on this runtime; orchestrate the stage flat from the conductor (mechanics §0).
- Executor stopped before finishing and about to launch a fresh session (or report `blocked`) → resume first: codex `--resume-last`; mimo re-dispatch with the recorded handle; native re-dispatch `stage-executor` with `mode: resume` (same cwd + model) (mechanics §4).
- About to print the whole mimo model list for the user to retype an id, or about to ASK model+variant for another stage without ever offering to pin → STOP. Narrow provider-first, and offer the pin after the first stage (Conductor pre-dispatch).
- No sprint doc yet but already brainstorming a stage → create the branch + doc and decompose first.
