# mimo-code Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> When authoring the SKILL.md and the subagent (Task 6), REQUIRED SUB-SKILL: Use superpowers:writing-skills (RED→GREEN→REFACTOR — baseline test BEFORE writing).
> All code tasks: REQUIRED SUB-SKILL: Use superpowers:test-driven-development.

**Goal:** Ship a first-party `mimo-code` Claude Code plugin that delegates write-capable coding sessions to the `mimo` CLI (Xiaomi's opencode fork), captures each session id to a parallel-safe file, and resumes by session id.

**Architecture:** A skill `mimo-code` (sole entry point) resolves model/effort and dispatches a sonnet subagent `mimo-delegate`. The subagent runs a thin launcher `mimo-run.mjs` in foreground: it spawns `mimo run --format json --dangerously-skip-permissions`, captures the `sessionID` off the first NDJSON line into `<handle>.sessionid` (atomic write, O_EXCL per-handle lock), and streams mimo's output through unchanged. Resume re-invokes the launcher with `--resume`, which injects `--session <id>`.

**Tech Stack:** Node.js ≥24 (`node:test`, no external deps), `mimo` CLI, Claude Code plugin (skills + agents), bash.

**Design reference:** `docs/plans/2026-06-13-mimo-code-design.md`.

**Pre-flight (run once at the start, in the implementation worktree):**

```bash
node --version          # expect v24+
command -v mimo         # expect a path; the launcher tests use a fake, but smoke needs it
```

---

### Task 1: Scaffold the plugin and register it

**Files:**
- Create: `mimo-code/.claude-plugin/plugin.json`
- Create: `mimo-code/package.json`
- Modify: `.claude-plugin/marketplace.json` (add the plugin entry)

**Step 1: Create the plugin manifest**

`mimo-code/.claude-plugin/plugin.json`:

```json
{
  "name": "mimo-code",
  "description": "Delegate write-capable coding sessions to the mimo CLI (Xiaomi's opencode fork); captures session ids for parallel-safe resume",
  "version": "0.1.0",
  "author": { "name": "Andrey Kuz" }
}
```

**Step 2: Create a test-only package.json**

`mimo-code/package.json` (no dependencies; just a test script):

```json
{
  "name": "mimo-code",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test scripts/test/"
  }
}
```

**Step 3: Register in the marketplace**

Add to the `plugins` array in `.claude-plugin/marketplace.json`:

```json
{ "name": "mimo-code", "source": "./mimo-code", "description": "Delegate coding sessions to the mimo CLI" }
```

**Step 4: Verify the JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('mimo-code/.claude-plugin/plugin.json')); JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json')); console.log('ok')"`
Expected: `ok`

**Step 5: Commit**

```bash
git add mimo-code/.claude-plugin/plugin.json mimo-code/package.json .claude-plugin/marketplace.json
git commit -m "feat(mimo-code): scaffold plugin and register in marketplace"
```

---

### Task 2: The fake-mimo test fixture

A test double standing in for the real `mimo` binary so unit/e2e tests never hit the network or edit files. Selected via the `MIMO_BIN` env var that the launcher honors.

**Files:**
- Create: `mimo-code/scripts/test/fixtures/fake-mimo.mjs`

**Step 1: Write the fixture**

`mimo-code/scripts/test/fixtures/fake-mimo.mjs`:

```js
#!/usr/bin/env node
// Stand-in for `mimo`. Receives `run --format json --dangerously-skip-permissions [--session <id>] [...]`.
// - records its argv to FAKE_MIMO_ARGS_OUT (if set) for assertions
// - `--session badid` → emit nothing, error on stderr, exit 1 (mimics a bad/unknown session)
// - otherwise emit 3 NDJSON lines carrying a sessionID, exit 0
import fs from "node:fs";
import process from "node:process";

const argv = process.argv.slice(2);
const out = process.env.FAKE_MIMO_ARGS_OUT;
if (out) fs.writeFileSync(out, JSON.stringify(argv));

const si = argv.indexOf("--session");
const session = si >= 0 ? argv[si + 1] : null;

if (session === "badid") {
  process.stderr.write("session badid not found\n");
  process.exit(1);
}

const sid = session || "ses_fake";
for (const obj of [
  { sessionID: sid, type: "step_start" },
  { sessionID: sid, type: "text", part: { text: "working" } },
  { sessionID: sid, type: "step_finish", part: { reason: "stop" } },
]) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}
process.exit(0);
```

**Step 2: Verify it runs standalone**

Run: `MIMO_BIN=ignored node mimo-code/scripts/test/fixtures/fake-mimo.mjs run --format json`
Expected: three JSON lines, the first containing `"sessionID":"ses_fake"`.

**Step 3: Commit**

```bash
git add mimo-code/scripts/test/fixtures/fake-mimo.mjs
git commit -m "test(mimo-code): add fake-mimo fixture"
```

---

### Task 3: Launcher — pure helpers (arg parsing, paths, atomic write, lock)

TDD the pure, side-effect-light helpers first. Implement them as named exports in `mimo-run.mjs`; `main()` runs only when the file is executed directly.

**Files:**
- Create: `mimo-code/scripts/mimo-run.mjs`
- Test: `mimo-code/scripts/test/helpers.test.mjs`

**Step 1: Write the failing test**

`mimo-code/scripts/test/helpers.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs, stateDir, writeAtomic, acquireLock, isAlive, buildMimoArgs } from "../mimo-run.mjs";

test("parseArgs splits launcher flags from forwarded args at --", () => {
  const a = parseArgs(["--handle", "h1", "--cwd", "/x", "--", "-m", "openai/gpt-5.4", "do it"]);
  assert.equal(a.handle, "h1");
  assert.equal(a.cwd, "/x");
  assert.equal(a.resume, false);
  assert.deepEqual(a.forward, ["-m", "openai/gpt-5.4", "do it"]);
});

test("parseArgs rejects a missing handle and a bad handle", () => {
  assert.throws(() => parseArgs(["--cwd", "/x"]), /handle is required/);
  assert.throws(() => parseArgs(["--handle", "Bad Handle", "--cwd", "/x"]), /invalid handle/);
});

test("stateDir is deterministic per cwd and namespaced", () => {
  const env = { XDG_STATE_HOME: "/tmp/state" };
  const d1 = stateDir("/repo/a", env);
  const d2 = stateDir("/repo/a", env);
  const d3 = stateDir("/repo/b", env);
  assert.equal(d1, d2);
  assert.notEqual(d1, d3);
  assert.ok(d1.startsWith("/tmp/state/mimo-code/"));
});

test("writeAtomic replaces content without leaving temp files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mimo-aw-"));
  const f = path.join(dir, "x.sessionid");
  writeAtomic(f, "ses_1");
  writeAtomic(f, "ses_2");
  assert.equal(fs.readFileSync(f, "utf8"), "ses_2");
  assert.deepEqual(fs.readdirSync(dir), ["x.sessionid"]);
});

test("acquireLock errors when a live pid holds it, reclaims a stale lock", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mimo-lock-"));
  const lock = path.join(dir, "h.lock");
  acquireLock(lock, process.pid);                  // first holder
  assert.throws(() => acquireLock(lock, process.pid), /handle busy/); // live → busy
  fs.writeFileSync(lock, "999999");                // simulate a dead pid
  assert.doesNotThrow(() => acquireLock(lock, process.pid)); // stale → reclaimed
});

test("buildMimoArgs injects --session on resume and fails without a sidecar", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mimo-ba-"));
  const sid = path.join(dir, "h.sessionid");
  assert.throws(
    () => buildMimoArgs({ resume: true, forward: [], sidPath: sid }),
    /no recorded session/
  );
  fs.writeFileSync(sid, "ses_xyz\n");
  assert.deepEqual(
    buildMimoArgs({ resume: true, forward: ["more"], sidPath: sid }),
    ["run", "--format", "json", "--dangerously-skip-permissions", "--session", "ses_xyz", "more"]
  );
  assert.deepEqual(
    buildMimoArgs({ resume: false, forward: ["-m", "x", "task"], sidPath: sid }),
    ["run", "--format", "json", "--dangerously-skip-permissions", "-m", "x", "task"]
  );
});
```

**Step 2: Run to verify it fails**

Run: `node --test mimo-code/scripts/test/helpers.test.mjs`
Expected: FAIL — `Cannot find module ... mimo-run.mjs` (or the named exports are undefined).

**Step 3: Write the implementation**

`mimo-code/scripts/mimo-run.mjs`:

```js
#!/usr/bin/env node
// mimo-run.mjs — thin launcher around `mimo run`.
//
// Captures the session id off the first NDJSON line into <handle>.sessionid and
// streams mimo's output through unchanged. Owns only --handle/--cwd/--resume;
// everything after `--` is forwarded to `mimo run` verbatim. The mimo binary is
// `mimo` unless MIMO_BIN overrides it (used by tests + nix path pinning).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import readline from "node:readline";
import process from "node:process";
import { pathToFileURL } from "node:url";

export function parseArgs(argv) {
  const out = { handle: null, cwd: null, resume: false, forward: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") { out.forward = argv.slice(i + 1); break; }
    if (a === "--handle") { out.handle = argv[++i]; continue; }
    if (a === "--cwd") { out.cwd = argv[++i]; continue; }
    if (a === "--resume") { out.resume = true; continue; }
    throw new Error(`unknown launcher arg: ${a}`);
  }
  if (!out.handle) throw new Error("--handle is required");
  if (!out.cwd) throw new Error("--cwd is required");
  if (!/^[a-z0-9_-]+$/.test(out.handle)) {
    throw new Error(`invalid handle (need [a-z0-9_-]): ${out.handle}`);
  }
  return out;
}

export function stateDir(cwd, env = process.env) {
  const base = env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state");
  const hash = crypto.createHash("sha256").update(path.resolve(cwd)).digest("hex").slice(0, 16);
  return path.join(base, "mimo-code", hash);
}

export function writeAtomic(file, text) {
  const tmp = `${file}.tmp.${crypto.randomBytes(6).toString("hex")}`;
  fs.writeFileSync(tmp, text, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function isAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (e) { return e.code === "EPERM"; }
}

export function acquireLock(lockPath, pid = process.pid) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const fd = fs.openSync(lockPath, "wx", 0o600); // O_EXCL — atomic exclusive create
      fs.writeSync(fd, String(pid));
      fs.closeSync(fd);
      return;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      let owner = NaN;
      try { owner = Number(fs.readFileSync(lockPath, "utf8").trim()); } catch { /* unreadable */ }
      if (Number.isInteger(owner) && owner > 0 && isAlive(owner)) {
        throw new Error(`handle busy: lock held by live pid ${owner}`);
      }
      try { fs.unlinkSync(lockPath); } catch { /* someone else reclaimed it */ }
    }
  }
  throw new Error("could not acquire lock after stale reclaim");
}

export function buildMimoArgs({ resume, forward, sidPath }) {
  const base = ["run", "--format", "json", "--dangerously-skip-permissions"];
  if (resume) {
    let sid = "";
    try { sid = fs.readFileSync(sidPath, "utf8").trim(); }
    catch { throw new Error("no recorded session for this handle (cannot --resume)"); }
    if (!sid) throw new Error("recorded session id is empty");
    return [...base, "--session", sid, ...forward];
  }
  return [...base, ...forward];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = stateDir(args.cwd);
  fs.mkdirSync(dir, { recursive: true });
  const sidPath = path.join(dir, `${args.handle}.sessionid`);
  const lockPath = path.join(dir, `${args.handle}.lock`);
  const logPath = path.join(dir, `${args.handle}.ndjson`);

  const mimoArgs = buildMimoArgs({ resume: args.resume, forward: args.forward, sidPath });
  const mimoBin = process.env.MIMO_BIN || "mimo";

  acquireLock(lockPath);
  const release = () => { try { fs.unlinkSync(lockPath); } catch { /* best-effort */ } };
  process.on("exit", release);

  const child = spawn(mimoBin, mimoArgs, { cwd: args.cwd, stdio: ["ignore", "pipe", "inherit"] });
  const log = fs.createWriteStream(logPath, { flags: "w" });
  let captured = args.resume; // on resume the id is already known/recorded

  const rl = readline.createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    process.stdout.write(line + "\n");   // passthrough, as-is
    log.write(line + "\n");
    if (!captured) {
      try {
        const obj = JSON.parse(line);
        if (obj && obj.sessionID) { writeAtomic(sidPath, String(obj.sessionID)); captured = true; }
      } catch { /* non-JSON line — ignore */ }
    }
  });

  child.on("error", (e) => {
    release();
    process.stderr.write(`mimo-run: spawn failed: ${e.message}\n`);
    process.exit(127);
  });
  child.on("close", (code, signal) => {
    log.end();
    release();
    process.exit(code == null ? (signal ? 1 : 0) : code);
  });
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((e) => { process.stderr.write(`mimo-run: ${e.message}\n`); process.exit(2); });
}
```

**Step 4: Run to verify it passes**

Run: `node --test mimo-code/scripts/test/helpers.test.mjs`
Expected: PASS (6 tests).

**Step 5: Commit**

```bash
git add mimo-code/scripts/mimo-run.mjs mimo-code/scripts/test/helpers.test.mjs
git commit -m "feat(mimo-code): launcher helpers (args, paths, atomic write, lock) with tests"
```

---

### Task 4: Launcher — end-to-end behavior against fake-mimo

Drive the real `main()` by spawning the launcher as a child process, with `MIMO_BIN` pointed at the fixture and `XDG_STATE_HOME` at a temp dir.

**Files:**
- Test: `mimo-code/scripts/test/launcher-e2e.test.mjs`

**Step 1: Write the failing test**

`mimo-code/scripts/test/launcher-e2e.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const launcher = path.join(here, "..", "mimo-run.mjs");
const fakeMimo = path.join(here, "fixtures", "fake-mimo.mjs");

function run(args, { extraEnv = {} } = {}) {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "mimo-e2e-"));
  const env = { ...process.env, MIMO_BIN: process.execPath, XDG_STATE_HOME: state, ...extraEnv };
  // Prepend the fake-mimo script so MIMO_BIN (node) runs it: node <fake-mimo> <forwarded...>
  const res = spawnSync(process.execPath, [launcher, ...args], { env, encoding: "utf8" });
  return { res, state };
}

// The launcher calls `MIMO_BIN run --format json ...`. To make MIMO_BIN=node run our
// fake, we wrap it: set MIMO_BIN to a tiny shim via NODE flag is awkward, so instead
// the fixture is invoked through `node <fake>` — we achieve that by making MIMO_BIN a
// shell script. Simpler: use a wrapper that execs the fixture.
```

> NOTE FOR EXECUTOR: `MIMO_BIN` is treated as the executable name. The fixture is a
> node script, so `MIMO_BIN` must be a runnable program, not "node fake-mimo.mjs".
> Create a tiny executable wrapper in each test (chmod +x) that execs the fixture, OR
> make `fake-mimo.mjs` itself executable with a shebang and point `MIMO_BIN` at it.
> Use the shebang approach (simplest): `fs.chmodSync(fakeMimo, 0o755)` in a `before()`
> hook and set `MIMO_BIN: fakeMimo`. Rewrite `run()` accordingly:

```js
import { test, before } from "node:test";
// ...
before(() => { fs.chmodSync(fakeMimo, 0o755); });

function run(args, { extraEnv = {} } = {}) {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "mimo-e2e-"));
  const env = { ...process.env, MIMO_BIN: fakeMimo, XDG_STATE_HOME: state, ...extraEnv };
  const res = spawnSync(process.execPath, [launcher, ...args], { env, encoding: "utf8" });
  return { res, state };
}

function stateFileDir(state) {
  const root = path.join(state, "mimo-code");
  return path.join(root, fs.readdirSync(root)[0]);
}

test("fresh delegate captures the session id and streams output", () => {
  const { res, state } = run(["--handle", "h1", "--cwd", process.cwd(), "--", "build it"]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /"sessionID":"ses_fake"/);
  assert.match(res.stdout, /"text":"working"/);
  const sid = fs.readFileSync(path.join(stateFileDir(state), "h1.sessionid"), "utf8");
  assert.equal(sid, "ses_fake");
});

test("resume reads the sidecar and forwards --session", () => {
  const argsOut = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mimo-args-")), "argv.json");
  const { res, state } = run(["--handle", "h1", "--cwd", process.cwd(), "--", "first"]);
  assert.equal(res.status, 0, res.stderr);
  // Re-run as resume against the SAME state dir.
  const dir = stateFileDir(state);
  const sid = fs.readFileSync(path.join(dir, "h1.sessionid"), "utf8");
  const r2 = spawnSync(process.execPath, [launcher, "--handle", "h1", "--cwd", process.cwd(), "--resume", "--", "more"], {
    env: { ...process.env, MIMO_BIN: fakeMimo, XDG_STATE_HOME: state, FAKE_MIMO_ARGS_OUT: argsOut },
    encoding: "utf8",
  });
  assert.equal(r2.status, 0, r2.stderr);
  const forwarded = JSON.parse(fs.readFileSync(argsOut, "utf8"));
  assert.ok(forwarded.includes("--session"));
  assert.equal(forwarded[forwarded.indexOf("--session") + 1], sid);
});

test("resume without a sidecar fails clearly", () => {
  const { res } = run(["--handle", "ghost", "--cwd", process.cwd(), "--resume", "--", "x"]);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /no recorded session/);
});

test("bad session exits non-zero and does not overwrite the sidecar", () => {
  // Seed a sidecar with 'badid', resume → fake exits 1.
  const { state } = run(["--handle", "h2", "--cwd", process.cwd(), "--", "first"]);
  const dir = stateFileDir(state);
  fs.writeFileSync(path.join(dir, "h2.sessionid"), "badid");
  const r2 = spawnSync(process.execPath, [launcher, "--handle", "h2", "--cwd", process.cwd(), "--resume", "--", "x"], {
    env: { ...process.env, MIMO_BIN: fakeMimo, XDG_STATE_HOME: state },
    encoding: "utf8",
  });
  assert.equal(r2.status, 1);
  assert.match(r2.stderr, /badid not found/);
  assert.equal(fs.readFileSync(path.join(dir, "h2.sessionid"), "utf8"), "badid");
});
```

> EXECUTOR: keep only the second (shebang-based) `run()` and the `before()` hook;
> the first block is illustrative of the pitfall. Verify `fake-mimo.mjs` starts with
> `#!/usr/bin/env node` (it does) so `MIMO_BIN=<fixture path>` is directly executable.

**Step 2: Run to verify it fails**

Run: `node --test mimo-code/scripts/test/launcher-e2e.test.mjs`
Expected: FAIL initially (before fixing the `run()`/chmod wiring), then drive to green.

**Step 3: Make it pass**

No launcher changes should be needed — fix only the test wiring (shebang + chmod). If a real bug surfaces (e.g., race between `close` and the last `line`), fix `mimo-run.mjs` minimally and note it.

**Step 4: Run the full suite**

Run: `cd mimo-code && npm test`
Expected: PASS (all helper + e2e tests).

**Step 5: Commit**

```bash
git add mimo-code/scripts/test/launcher-e2e.test.mjs
git commit -m "test(mimo-code): end-to-end launcher tests against fake-mimo"
```

---

### Task 5: The `mimo-delegate` subagent

A thin sonnet forwarder. It builds exactly one launcher invocation, watches the stream, and returns a distilled summary + handle + sessionId + changed files. It does NOT reason about the task itself.

**Files:**
- Create: `mimo-code/agents/mimo-delegate.md`

**Step 1: Write the agent**

`mimo-code/agents/mimo-delegate.md`:

```markdown
---
name: mimo-delegate
model: sonnet
description: Runs one mimo coding session via the mimo-run launcher and returns a distilled result. Use when the mimo-code skill delegates or resumes a mimo session.
allowedTools:
  - Bash
  - Read
  - Glob
  - Grep
---

# mimo-delegate

You run ONE mimo session through the launcher and report back. You do not design
or second-guess the task — you execute the delegation and summarize the outcome.

## Inputs (from the dispatching skill)
- `handle` — unique slug for this session (`[a-z0-9_-]`).
- `cwd` — absolute workspace directory.
- `model` / `variant` — optional; only on a fresh run.
- `prompt` — the task (fresh) or the continuation (resume).
- `mode` — `fresh` or `resume`.

## What you do
1. Resolve the launcher path: it is `scripts/mimo-run.mjs` inside this plugin
   (the skill passes you its absolute path as `LAUNCHER`).
2. Run EXACTLY ONE foreground Bash call (set a generous `timeout`, up to the max):
   - Fresh: `node "$LAUNCHER" --handle <handle> --cwd <cwd> -- [-m <model>] [--variant <variant>] "<prompt>"`
   - Resume: `node "$LAUNCHER" --handle <handle> --cwd <cwd> --resume -- "<prompt>"`
3. Read the streamed NDJSON. Determine: did mimo finish (a `step_finish` with
   `reason: "stop"`), error, or get cut off (timeout/non-zero exit)?
4. Collect changed files with `git -C <cwd> status --porcelain` (and `git diff --stat`).

## What you return to the main thread (concise — no raw NDJSON dump)
- `handle` and `sessionId` (read `<state>/<handle>.sessionid` if you need it).
- One-paragraph summary of what mimo did.
- `status`: done | incomplete | error, and WHY (quote mimo's final text or stderr).
- Changed files list.
- If incomplete/error: state plainly that the caller can resume this `handle`.

## Rules
- NEVER use `--continue`; resume is always by recorded session id (the launcher
  enforces this).
- NEVER stream raw NDJSON back to the main thread — summarize.
- One launcher call per dispatch. If it times out, report incomplete + resumable;
  do not loop.
```

**Step 2: Verify frontmatter parses**

Run: `node -e "const s=require('fs').readFileSync('mimo-code/agents/mimo-delegate.md','utf8'); if(!s.startsWith('---')) throw new Error('no frontmatter'); console.log('ok')"`
Expected: `ok`

**Step 3: Commit**

```bash
git add mimo-code/agents/mimo-delegate.md
git commit -m "feat(mimo-code): add mimo-delegate subagent (sonnet)"
```

---

### Task 6: The `mimo-code` skill — authored with writing-skills (RED→GREEN→REFACTOR)

> **REQUIRED SUB-SKILL: Use superpowers:writing-skills.** The Iron Law applies:
> NO SKILL WITHOUT A FAILING TEST FIRST. Run the baseline BEFORE writing SKILL.md.

**Files:**
- Create: `mimo-code/skills/mimo-code/SKILL.md`
- Scratch (not committed): `docs/plans/mimo-code-skill-baseline.md` (baseline notes)

**Step 1 (RED): Baseline — dispatch a subagent WITHOUT the skill**

Give a fresh general-purpose subagent only the design doc and this task:
"The user typed `/mimo-code build a JSON logger`. Drive a mimo session to do it."
Record verbatim what it gets wrong, e.g.:
- Does it resolve the model via `mimo models` ∩ `mimo providers list`, or invent `--model`?
- Does it run the work in the main thread instead of dispatching `mimo-delegate`?
- On resume, does it reach for `--continue`?
- Does it pick a unique handle for parallel safety?

Write the observed failures into `docs/plans/mimo-code-skill-baseline.md`.

**Step 2 (GREEN): Write the skill addressing those exact failures**

`mimo-code/skills/mimo-code/SKILL.md` (draft — adapt to close the baseline gaps;
keep the description triggers-only, NEVER a workflow summary):

```markdown
---
name: mimo-code
description: Use when delegating a coding task to mimo (the mimo CLI / Xiaomi opencode fork) — offloading implementation to mimo, resuming a mimo session, or running work on a chosen provider/model. Triggers on "/mimo-code", "run mimo", "delegate to mimo", "resume the mimo session", "offload this to mimo".
---

# mimo-code

## Overview
Delegate a write-capable coding session to `mimo`, keep Claude as the conductor.
Heavy work and tokens move to mimo; you orchestrate and review the diff.

## When to use
- The user invokes `/mimo-code [provider/model] [variant] <task>` or asks to run/resume mimo.
- A prior mimo session needs continuation (it asked something or was cut off).

## The one rule that shapes everything
Never run mimo in the main thread. ALWAYS dispatch the `mimo-delegate` subagent so
the live stream and any waiting stay out of the main context.

## Parse the invocation
`/mimo-code [provider/model] [variant] <task>`
- A leading `xxx/yyy` token → model. A following `minimal|low|medium|high|max` → variant.
- The rest is the task. Natural-language requests map the same way.

## Resolve the model (only when not given, only on a fresh run)
1. `mimo providers list` → authenticated providers. None → STOP: tell the user to run `mimo providers login`.
2. `mimo models` → catalogue; keep only models whose provider is authenticated.
3. Exactly one usable → auto-pick. Otherwise show the list (grouped by provider) and ask
   (AskUserQuestion when ≤4; else print and have them name an id).
4. Ask effort/variant, offering a "default" that omits `--variant`.

## Pick a handle
Generate a UNIQUE slug per delegation (`[a-z0-9_-]`, e.g. from the task + a short
suffix). Parallel sessions MUST use distinct handles — that is what keeps their
state files from clashing.

## Dispatch
Dispatch `mimo-delegate` (model sonnet) with: handle, cwd (absolute), model/variant
(fresh only), the prompt, mode (fresh|resume), and the absolute LAUNCHER path
(`<this plugin>/scripts/mimo-run.mjs`). Relay its summary; never echo raw NDJSON.

## Resume
Same handle, `mode: resume`, the continuation prompt. Do NOT re-ask for a model
(the session remembers it). The launcher resumes by recorded session id — never `--continue`.

## Common mistakes
- Running mimo inline instead of via the subagent → pollutes context. Always subagent.
- Inventing `--model`/`--variant` as user-facing flags → they are positional skill args.
- Resuming with `--continue` → cross-dir pollution; resume is by session id only.
- Reusing a handle for parallel runs → state clash; one unique handle each.
```

**Step 3 (GREEN verify): Re-run the baseline scenario WITH the skill**

Dispatch a fresh subagent given the skill. Confirm it now: dispatches `mimo-delegate`,
resolves the model via the intersection, picks a unique handle, and resumes by id.

**Step 4 (REFACTOR): Close new loopholes**

Any new rationalization → add an explicit counter to "Common mistakes". Re-test
until compliant. Keep the description triggers-only.

**Step 5: Commit**

```bash
git add mimo-code/skills/mimo-code/SKILL.md
git commit -m "feat(mimo-code): add mimo-code skill (entry point)"
```

---

### Task 7: Live smoke + version/marketplace finalization

**Step 1: Live smoke against the real mimo (manual, gated)**

With a real authenticated provider, run a tiny safe task in a throwaway dir:

```bash
mkdir -p /tmp/mimo-smoke && cd /tmp/mimo-smoke && git init -q
node <plugin>/scripts/mimo-run.mjs --handle smoke1 --cwd /tmp/mimo-smoke -- -m <provider/model> "create hello.txt containing hi"
```
Expected: NDJSON streams to stdout; `~/.local/state/mimo-code/<hash>/smoke1.sessionid` exists and is non-empty; `hello.txt` created. Then resume:
```bash
node <plugin>/scripts/mimo-run.mjs --handle smoke1 --cwd /tmp/mimo-smoke --resume -- "append world to hello.txt"
```
Expected: same session id reused; file appended.

**Step 2: Final full test run**

Run: `cd mimo-code && npm test`
Expected: PASS.

**Step 3: Commit any fixes, then deploy via the submodule rules**

Per repo CLAUDE.md: this `cc` submodule must be committed, then the superproject
gitlink bumped, before home-manager activation reflects the new plugin.

```bash
# in the cc submodule:
git add -A && git commit -m "feat(mimo-code): live-smoke fixes"   # if any
# (push the submodule before bumping the parent gitlink — see CLAUDE.md)
```

> EXECUTOR: do NOT push or bump the parent gitlink unless the user asks. Stop here
> and report; the user controls deployment.

---

## Notes for the executor
- DRY/YAGNI: no `status`/`cancel`/`list` subcommands unless a real need appears.
- The launcher stays a dumb pipe — resist adding NDJSON parsing/enveloping to it.
- Keep the SKILL.md description triggers-only (writing-skills CSO): a workflow
  summary there makes Claude skip the body.
- If the foreground run hits the Bash 10-min cap, that is expected — the captured
  session id makes it resumable. Do not add background/daemon machinery.
```
