# Engine-Agnostic Sprint (codex + mimo) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the `codex-sprint` plugin into an engine-agnostic `sprint` plugin that can delegate stage implementation to either codex (probe) or mimo (hard dependency), with a single source of truth and no duplicated files.

**Architecture:** One `sprint` skill keeps all engine-neutral orchestration; only executor selection, step-4 Execute, and resume lines are engine-specific. mimo is guaranteed via a plugin `dependencies` declaration; codex stays a runtime probe. Model resolution for mimo is shared via a new `mimo-resolve` subagent (sonnet) backed by a `resolve-models` launcher subcommand, and resolved on every stage unless the user pins a model. The launcher is invoked with bun, falling back to node.

**Tech Stack:** Claude Code plugins (plugin.json/marketplace.json), Markdown skills/agents, Node ESM launcher (`mimo-run.mjs`, runtime-agnostic `node:` builtins), `node:test`, bun.

**Companion design:** `docs/plans/2026-06-15-sprint-engine-agnostic-design.md`.

**Working location:** the `cc` submodule, in worktree `.claude/worktrees/sprint-engine-agnostic-design` (branch `worktree-sprint-engine-agnostic-design`). All paths below are relative to the `cc` submodule root.

**Conventions for this plan:**
- TDD applies to the launcher (Phase 1). Markdown/JSON artifacts (Phases 2–6) are verified by JSON-lint, grep self-consistency checks, and a manual read-back — there are no unit tests for skill prose.
- Commit after each task. Conventional Commits.
- Do NOT push or bump the superproject gitlink until Phase 7.

---

## Phase 0: Discovery (blocking — do first)

### Task 0.1: Capture mimo provider/model output format

**Why:** `resolve-models` must parse real `mimo` output. We do not know the format. Everything in Phase 1 depends on this.

**Step 1:** Determine the mimo binary: `command -v mimo || echo "MIMO_BIN required"`.

**Step 2:** Capture output of each, trying JSON first:
```bash
mimo providers list 2>&1 | head -40
mimo providers list --json 2>&1 | head -40   # does --json exist?
mimo models 2>&1 | head -60
mimo models --json 2>&1 | head -60           # does --json exist?
```

**Step 3:** Record in a scratch note (not committed): the exact subcommand names, whether `--json` is supported, the field names, and whether model ids are `provider/model` or bare. Note which providers count as "authenticated" in `providers list` output (marker/column).

**If mimo is not installed or not authenticated in this environment:** STOP and ask the user to paste the output of the four commands above. This is a genuine blocker — `needs input`.

**Decision recorded by this task (drives Phase 1):**
- **Path A (machine-readable):** `mimo providers ... --json` and `mimo models --json` exist → launcher parses + intersects, emits structured JSON.
- **Path B (text only):** no JSON flags → launcher emits a raw envelope `{providersRaw, modelsRaw}` and the `mimo-resolve` subagent interprets the text.

No commit (discovery only).

---

## Phase 1: Launcher `resolve-models` subcommand (TDD)

All edits in `mimo-code/scripts/`.

### Task 1.1: Extend fake-mimo fixture to answer providers/models

**Files:**
- Modify: `mimo-code/scripts/test/fixtures/fake-mimo.mjs`

**Step 1:** Add handling, BEFORE the existing `run` logic, for the subcommands discovered in 0.1. Match the real format from 0.1. Example for Path A (adjust field names to discovery):
```js
const sub = argv[0];
if (sub === "providers" && argv[1] === "list") {
  // emit the same shape real `mimo providers list [--json]` uses
  process.stdout.write(JSON.stringify([
    { id: "openai", authenticated: true },
    { id: "anthropic", authenticated: false },
  ]) + "\n");
  process.exit(0);
}
if (sub === "models") {
  process.stdout.write(JSON.stringify([
    { provider: "openai", id: "openai/gpt-5.4" },
    { provider: "anthropic", id: "anthropic/claude-x" },
  ]) + "\n");
  process.exit(0);
}
```
For Path B, emit the captured human-readable text instead.

**Step 2 (commit):**
```bash
git add mimo-code/scripts/test/fixtures/fake-mimo.mjs
git commit -m "test(mimo-code): fake-mimo answers providers/models"
```

### Task 1.2: Write the failing test for resolve-models

**Files:**
- Modify: `mimo-code/scripts/test/helpers.test.mjs` (or new `resolve.test.mjs`)

**Step 1:** Add a unit test for a new exported pure function `resolveModels({providersRaw, modelsRaw})` (Path A: parses+intersects; Path B: returns the raw envelope). Pure parsing is unit-testable without spawning:
```js
import { resolveModels } from "../mimo-run.mjs";
test("resolveModels keeps only models of authenticated providers", () => {
  const out = resolveModels({
    providers: [{ id: "openai", authenticated: true }, { id: "anthropic", authenticated: false }],
    models: [{ provider: "openai", id: "openai/gpt-5.4" }, { provider: "anthropic", id: "anthropic/claude-x" }],
  });
  assert.deepEqual(out.options, [{ provider: "openai", model: "openai/gpt-5.4" }]);
  assert.deepEqual(out.authenticatedProviders, ["openai"]);
});
test("resolveModels flags zero authenticated providers", () => {
  const out = resolveModels({ providers: [{ id: "openai", authenticated: false }], models: [] });
  assert.equal(out.options.length, 0);
  assert.equal(out.authenticatedProviders.length, 0);
});
```
Plus one e2e test in `launcher-e2e.test.mjs` that runs the subcommand end-to-end against fake-mimo via `MIMO_BIN`:
```js
test("resolve-models --json emits authenticated options", () => {
  const res = spawnSync(process.execPath, [LAUNCHER, "resolve-models", "--json"],
    { env: { ...process.env, MIMO_BIN: FAKE_MIMO }, encoding: "utf8" });
  const out = JSON.parse(res.stdout);
  assert.ok(out.options.some(o => o.model === "openai/gpt-5.4"));
});
```

**Step 2 (verify fail):** `cd mimo-code && node --test 'scripts/test/**/*.test.mjs'` → FAIL (`resolveModels` not exported / unknown subcommand).

### Task 1.3: Implement resolve-models

**Files:**
- Modify: `mimo-code/scripts/mimo-run.mjs`

**Step 1:** Extend `parseArgs` (or branch earlier in `main`) so the first token can be the subcommand `resolve-models`. Keep the existing `run` path (no subcommand token) intact — `resolve-models` is a sibling mode, not a forwarded arg. Add `export function resolveModels({providers, models})` (Path A) that filters models to authenticated providers and returns `{authenticatedProviders, options, variants: ["minimal","low","medium","high","max"]}`. Add a `resolveModelsMain()` that spawns `${MIMO_BIN||mimo} providers list [--json]` and `${MIMO_BIN||mimo} models [--json]`, parses per 0.1, calls `resolveModels`, and writes JSON to stdout. For Path B, `resolveModels` returns the raw envelope and `resolveModelsMain` emits `{providersRaw, modelsRaw, variants}`.

**Step 2 (verify pass):** `cd mimo-code && node --test 'scripts/test/**/*.test.mjs'` → PASS.

**Step 3 (commit):**
```bash
git add mimo-code/scripts/mimo-run.mjs mimo-code/scripts/test/
git commit -m "feat(mimo-code): add resolve-models launcher subcommand"
```

### Task 1.4: Verify the launcher runs under bun

**Step 1:** `bun mimo-code/scripts/mimo-run.mjs resolve-models --json` with `MIMO_BIN` pointed at fake-mimo → same JSON as node.
**Step 2:** If bun also runs `node:test` cleanly: `bun test` in `mimo-code` → record it. If not, node remains the test runner (no change). Document the outcome inline in the next commit message; no code change required for the launcher (it is already `node:`-builtin only).

---

## Phase 2: `mimo-resolve` subagent + bun-fallback in mimo-code

### Task 2.1: Create the mimo-resolve subagent

**Files:**
- Create: `mimo-code/agents/mimo-resolve.md`

**Step 1:** Write the agent (mirror `mimo-delegate.md` conventions):
- Frontmatter: `name: mimo-resolve`, `model: sonnet`, `description:` (resolves authenticated provider∩model options for the conductor), `allowedTools: [Bash, Read, Glob, Grep]`.
- Body: resolve launcher path the same way `mimo-delegate.md` does (nix-vendor path, marketplace-cache fallback, glob-free). Resolve runtime: `RUNNER=$(command -v bun || command -v node)`. Run exactly one call: `"$RUNNER" "$LAUNCHER" resolve-models --json`. Return a concise structured list of `{provider, model}` options + variants + a recommendation; if zero authenticated providers, say so plainly so the conductor tells the user to run `mimo providers login`. **Must NOT call AskUserQuestion** — gathering only; the conductor asks/auto-picks. Never dump raw catalogue text.

**Step 2 (verify):** read-back; confirm frontmatter parses (no tabs, valid YAML) and `model: sonnet` present.

**Step 3 (commit):**
```bash
git add mimo-code/agents/mimo-resolve.md
git commit -m "feat(mimo-code): add mimo-resolve subagent (sonnet)"
```

### Task 2.2: Switch mimo-delegate to bun-with-node fallback

**Files:**
- Modify: `mimo-code/agents/mimo-delegate.md`

**Step 1:** In the launcher invocation section, add `RUNNER=$(command -v bun || command -v node)` and change `node "$LAUNCHER" ...` → `"$RUNNER" "$LAUNCHER" ...` for both fresh and resume commands. Keep everything else.

**Step 2 (verify):** `grep -n 'RUNNER\|"\$LAUNCHER"' mimo-code/agents/mimo-delegate.md` shows no remaining bare `node "$LAUNCHER"`.

**Step 3 (commit):**
```bash
git add mimo-code/agents/mimo-delegate.md
git commit -m "refactor(mimo-code): invoke launcher via bun with node fallback"
```

### Task 2.3: Point mimo-code SKILL.md resolution at mimo-resolve + bump version

**Files:**
- Modify: `mimo-code/skills/mimo-code/SKILL.md`
- Modify: `mimo-code/.claude-plugin/plugin.json`

**Step 1:** Replace the "Resolve the model — ASK, do not default" section's inline `mimo providers list` / `mimo models` instructions with: dispatch the `mimo-resolve` subagent (keeps catalogue output out of context), then the conductor does the AskUserQuestion / auto-pick (ASK stays in conductor). Keep the ASK policy text (the "do not default" rule) — only the data-gathering moves to the subagent. Note the "tiny read-only" justification line is now obsolete; update it.

**Step 2:** Bump `mimo-code/.claude-plugin/plugin.json` `version` `0.1.1` → `0.2.0` (new subagent + behavior change).

**Step 3 (verify):** `node -e "JSON.parse(require('fs').readFileSync('mimo-code/.claude-plugin/plugin.json'))"` exits 0.

**Step 4 (commit):**
```bash
git add mimo-code/skills/mimo-code/SKILL.md mimo-code/.claude-plugin/plugin.json
git commit -m "feat(mimo-code)!: resolve models via mimo-resolve subagent"
```

---

## Phase 3: Rename codex-sprint → sprint

### Task 3.1: git mv plugin + skill directories

**Step 1:**
```bash
git mv codex-sprint sprint
git mv sprint/skills/codex-sprint sprint/skills/sprint
```
**Step 2 (verify):** `git status` shows renames; `ls sprint/skills/sprint/` has `SKILL.md` + `mechanics.md`.
**Step 3 (commit):**
```bash
git commit -m "refactor(sprint): rename codex-sprint plugin and skill to sprint"
```

### Task 3.2: plugin.json — name, dependency, version

**Files:**
- Modify: `sprint/.claude-plugin/plugin.json`

**Step 1:** Set:
```json
{
  "name": "sprint",
  "description": "Orchestrate one large milestone as staged brainstorm/plan/execute cycles in a living sprint doc, delegating implementation to codex or mimo",
  "version": "0.3.0",
  "dependencies": ["mimo-code"],
  "author": { "name": "Andrey Kuz" }
}
```
**Step 2 (verify):** JSON parses (as in 2.3 step 3).
**Step 3 (commit):**
```bash
git add sprint/.claude-plugin/plugin.json
git commit -m "feat(sprint)!: rename to sprint, depend on mimo-code"
```

### Task 3.3: marketplace.json entry

**Files:**
- Modify: `.claude-plugin/marketplace.json`

**Step 1:** Replace the `codex-sprint` plugin entry with:
```json
{ "name": "sprint", "source": "./sprint", "description": "Staged brainstorm/plan/execute sprints delegating implementation to codex or mimo" }
```
**Step 2 (verify):** JSON parses; `grep -c codex-sprint .claude-plugin/marketplace.json` → 0.
**Step 3 (commit):**
```bash
git add .claude-plugin/marketplace.json
git commit -m "chore(marketplace): codex-sprint -> sprint"
```

---

## Phase 4: sprint SKILL.md — engine-agnostic edits

**Files:**
- Modify: `sprint/skills/sprint/SKILL.md`

Keep ALL engine-neutral content (Overview, Starting a Sprint, isolation invariant, steps 1–3,5–8). Make only these edits:

### Task 4.1: Frontmatter + title

**Step 1:** `name: codex-sprint` → `name: sprint`. Rewrite `description:` to be engine-agnostic and mention both engines + resume triggers, e.g.: "...the coding is handed off to an executor (codex or mimo) while you stay the conductor. Triggers on 'long multistage project', 'milestone with multiple stages', 'resume where I left off', 'delegate implementation to codex or mimo'." Change the `# codex-sprint` heading to `# sprint`. Soften "Codex digs" tagline to "The executor digs."

### Task 4.2: Capability Probes table

**Step 1:** Replace the codex row with an **executor** row and add mimo specifics:
```
| superpowers | `superpowers:brainstorming` in skills list? | bare brainstorm + plan; recommend installing superpowers |
| executor: codex | `codex:rescue` in skills list? | not required — codex is optional; mimo is the dependency-guaranteed default |
| executor: mimo | `mimo-code:mimo-delegate` available? (hard dependency, should always be true) | if absent, the dependency failed to install — tell the user to reinstall sprint |
| codex SDD | (only if engine=codex) `fd -t d subagent-driven-development ...` | hand codex the whole plan |
| mimo model | (only if engine=mimo, unless pinned) dispatch `mimo-code:mimo-resolve` | conductor ASKs / auto-picks |
```

### Task 4.3: Engine selection + sprint-doc header

**Step 1:** Add an "Engine selection" subsection under "Starting a Sprint":
- Explicit arg `/sprint mimo|codex` wins. codex requested but absent → tell user to install codex plugin (or opt into bare).
- No arg: codex present → AskUserQuestion (mimo vs codex); codex absent → mimo.
- Record in the sprint-doc header. **Model is stored in the header ONLY when pinned:**
  - `Engine: codex`
  - `Engine: mimo` (resolve model every stage)
  - `Engine: mimo (model: <provider/model>, variant: <v>, pinned)` (reuse every stage; set only on explicit user pin like `/sprint mimo <provider/model> [variant]`)
**Step 2:** Update the sprint-doc template block to include the `Engine:` line and add `mimo:<handle>` to the example executing stage line.

### Task 4.4: Per-stage lifecycle wording

**Step 1:** Generalize step 4: "the executor implements the plan in the worktree (codex or mimo — mechanics §4); effort/model by engine." Add a conductor pre-dispatch note: "**(engine=mimo, unless pinned)** before dispatching the stage-runner, the conductor dispatches `mimo-resolve`, ASKs/auto-picks model+variant, generates a unique per-stage handle `<stage>-<rand4>`, and records `mimo:<handle>` on the stage line." Generalize the resume bullet: "codex: `task --resume-last`; mimo: re-dispatch `mimo-delegate` resume by the recorded handle — never fresh."

### Task 4.5: Common Mistakes + Red Flags

**Step 1:** Generalize every "codex"-specific row to "the executor" while keeping codex's `--resume-last` and mimo's resume-by-handle as the concrete fixes. Keep all isolation-invariant rows verbatim.

**Verify (4.1–4.5):**
```bash
grep -n 'codex' sprint/skills/sprint/SKILL.md   # remaining mentions must be intentional (codex as one engine), none implying codex-only
grep -c 'mimo' sprint/skills/sprint/SKILL.md     # > 0
```
**Commit:**
```bash
git add sprint/skills/sprint/SKILL.md
git commit -m "feat(sprint): engine-agnostic skill (codex + mimo)"
```

---

## Phase 5: sprint mechanics.md — two-variant step 4

**Files:**
- Modify: `sprint/skills/sprint/mechanics.md`

Keep §3, §5, §6, §7 and the slug/intro verbatim (they are engine-neutral). Edit only §4.

### Task 5.1: Split §4 into engine variants

**Step 1:** Restructure §4 as:
- **§4 Execute — preamble:** the engine is read from the sprint-doc `Engine:` header.
- **§4a Engine: codex** — the existing codex block verbatim (`CODEX=$(fd ...)`, `task --cwd "$WT" --write --effort ...`, and the resume block with `--resume-last`).
- **§4b Engine: mimo** — the stage-runner dispatches `mimo-code:mimo-delegate` as a nested subagent (same nesting §5 uses for review), passing `handle` (from the stage line), `cwd=<abs $WT>`, `model`/`variant` (from the conductor), `prompt = $(cat docs/plans/$S-plan.md)`, `mode: fresh`. Resume: re-dispatch `mimo-delegate` with the same `handle`, `mode: resume`, continuation prompt. Cap resumes (~2 → `blocked`), mirroring codex. Note: model/variant/handle come from the conductor's pre-dispatch (SKILL step 4 note); the stage-runner does not resolve models.
- **§4c Engine: bare** — the existing "executor absent → stage-runner implements itself" block.

**Step 2 (verify):** `grep -n 'mimo-delegate\|resume-last\|Engine:' sprint/skills/sprint/mechanics.md` shows all three variants present.

**Step 3 (commit):**
```bash
git add sprint/skills/sprint/mechanics.md
git commit -m "feat(sprint): two-variant execute mechanics (codex + mimo)"
```

---

## Phase 6: sprint README + design-doc fix

### Task 6.1: Rewrite README

**Files:**
- Modify: `sprint/README.md`

**Step 1:** Rewrite for engine-agnostic sprint: what it is, the codex-or-mimo executor, the mimo-code dependency (auto-installed), `/sprint`, `/sprint mimo`, `/sprint codex`, pin syntax.
**Step 2 (commit):** `git add sprint/README.md && git commit -m "docs(sprint): rewrite README for engine-agnostic sprint"`

### Task 6.2: Correct the design doc header rule

**Files:**
- Modify: `docs/plans/2026-06-15-sprint-engine-agnostic-design.md`

**Step 1:** Fix the `Engine:` example so the non-pinned mimo header carries no model (model lives in the header only when pinned). Keep everything else.
**Step 2 (commit):** `git add docs/plans/2026-06-15-sprint-engine-agnostic-design.md && git commit -m "docs(sprint): header carries model only when pinned"`

---

## Phase 7: Verification + integration wiring

### Task 7.1: Final mimo-code test suite

**Step 1:** `cd mimo-code && node --test 'scripts/test/**/*.test.mjs'` → all PASS. If bun proved node:test-compatible in 1.4, also `bun test`.

### Task 7.2: Structural self-checks

**Step 1:**
```bash
node -e "['.claude-plugin/marketplace.json','sprint/.claude-plugin/plugin.json','mimo-code/.claude-plugin/plugin.json'].forEach(f=>JSON.parse(require('fs').readFileSync(f)))"
grep -rn 'codex-sprint' . --include='*.json' --include='*.md' | grep -v docs/plans   # expect 0 (renamed everywhere)
test -d sprint/skills/sprint && test ! -e codex-sprint && echo OK
```
**Step 2:** Confirm `sprint/.claude-plugin/plugin.json` has `"dependencies": ["mimo-code"]`.

### Task 7.3: Manual dry-run review (no execution)

**Step 1:** Read `sprint/skills/sprint/SKILL.md` + `mechanics.md` end-to-end and confirm: a reader with no context can (a) pick an engine, (b) resolve a mimo model per stage or use the pin, (c) run a stage on either engine, (d) resume on either engine, (e) never violate the isolation invariant. Fix any gaps (loop back).

### Task 7.4: Finish the branch (requires user decision)

**REQUIRED SUB-SKILL:** superpowers:finishing-a-development-branch.

Submodule/superproject discipline (from `nix-config/CLAUDE.md`), to run only with explicit user go-ahead:
1. Merge worktree branch `worktree-sprint-engine-agnostic-design` into `cc` master (no force resets — ask before any).
2. Push the `cc` submodule first.
3. In the `nix-config` superproject: `git add homes/modules/claude-code/cc && git commit -m "chore(cc): engine-agnostic sprint plugin"`.
4. `home-manager` activation deploys to `~/.claude/`.
5. Post-deploy manual check (cannot be verified pre-deploy): installing `sprint` auto-pulls `mimo-code`; `/sprint`, `/sprint mimo`, `/sprint codex` select the right engine; resume reads `Engine:` + handle.

---

## Risks / open items

- **Phase 0 is a hard gate.** If `mimo` output has no JSON mode and the text is messy, prefer Path B (launcher returns raw envelope; `mimo-resolve` subagent interprets) over a brittle JS parser.
- **bun `node:test` support** is unverified — Task 1.4 decides; node remains the fallback test runner regardless.
- **Plugin-dependency auto-install** can only be fully verified post-deploy (Task 7.4 step 5).
- **Breaking rename** `codex-sprint` → `sprint`: anyone with the old name installed must reinstall. We own the marketplace, so acceptable.
