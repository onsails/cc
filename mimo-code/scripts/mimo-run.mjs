#!/usr/bin/env node
// mimo-run.mjs — thin launcher around `mimo run`.
//
// Captures the session id off the first NDJSON line into <handle>.sessionid and
// streams mimo's output through unchanged. Owns only --handle/--cwd/--resume;
// everything after `--` is forwarded to `mimo run` verbatim. The mimo binary is
// `mimo` unless MIMO_BIN overrides it (used by tests + nix path pinning).
//
// Permissions: we do NOT pass --dangerously-skip-permissions. Instead we inject a
// scoped permission policy via MIMOCODE_CONFIG_CONTENT (see PERMISSION_POLICY /
// buildConfigContent). mimo's default `build` agent already allows edit/bash/etc.
// within cwd; in headless `mimo run` a permission *ask* is auto-REJECTED (it never
// blocks on stdin), so the only knobs that matter are which permissions stay `ask`.
import { spawn, execFile } from "node:child_process";
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

// Permission policy injected into mimo via MIMOCODE_CONFIG_CONTENT (a merged
// "local" config source) — this replaces --dangerously-skip-permissions.
// `edit`/`bash`/`webfetch` are already allowed by mimo's default `build` agent;
// making them explicit is defensive + self-documenting. `external_directory`
// (paths outside cwd — e.g. a worktree's real gitdir or $TMPDIR) flips from the
// default `ask` to `allow` so legitimate out-of-cwd work isn't auto-rejected.
// `doom_loop` is INTENTIONALLY omitted: it stays `ask`, which headless `mimo run`
// auto-REJECTS — a runaway-loop circuit breaker. mimo resolves rules with
// findLast, so this (appended last as the highest-priority source) wins over the
// defaults. There is no interactive approval in headless mode: an ask is rejected,
// never queued — so a policy, not a watcher, is the lever.
export const PERMISSION_POLICY = Object.freeze({
  edit: "allow",
  bash: "allow",
  webfetch: "allow",
  external_directory: "allow",
});

// Merge PERMISSION_POLICY into any pre-existing MIMOCODE_CONFIG_CONTENT. Unrelated
// top-level keys and any permission keys we don't set (e.g. a user-supplied
// `doom_loop`/bash pattern map) are preserved; our four keys win on conflict. A
// non-JSON or non-object existing value is ignored (our policy still applies).
// Returns a JSON string ready to assign to MIMOCODE_CONFIG_CONTENT.
export function buildConfigContent(existing) {
  let base = {};
  if (existing != null && String(existing).trim() !== "") {
    try {
      const parsed = JSON.parse(existing);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) base = parsed;
    } catch { /* not JSON — start fresh; our policy still applies */ }
  }
  const prior = base.permission && typeof base.permission === "object" && !Array.isArray(base.permission)
    ? base.permission
    : {};
  return JSON.stringify({ ...base, permission: { ...prior, ...PERMISSION_POLICY } });
}

export function buildMimoArgs({ resume, forward, sidPath }) {
  const base = ["run", "--format", "json"];
  if (resume) {
    let sid = "";
    try { sid = fs.readFileSync(sidPath, "utf8").trim(); }
    catch { throw new Error("no recorded session for this handle (cannot --resume)"); }
    if (!sid) throw new Error("recorded session id is empty");
    return [...base, "--session", sid, ...forward];
  }
  return [...base, ...forward];
}

// formatProgress: map ONE raw mimo output line to a concise, human-readable
// progress string (or null to suppress). Pure + defensive — missing fields must
// never throw. The full raw NDJSON still goes to the log file; only stdout is
// distilled to this trace so a watching subagent reads steps, not raw JSON.
export function formatProgress(line) {
  if (line == null || String(line).trim() === "") return null;

  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    return "[mimo] " + line; // mimo's own non-JSON notes — pass through, prefixed
  }
  if (!obj || typeof obj !== "object") return "[mimo] " + line;

  const truncate = (s, n) => {
    const str = String(s);
    return str.length > n ? str.slice(0, n - 1) + "…" : str;
  };
  const firstLineTruncated = (s, n) => truncate(String(s).split("\n")[0], n);
  const part = obj.part && typeof obj.part === "object" ? obj.part : {};
  const type = obj.type;

  switch (type) {
    case "step_start":
      return "[mimo] ▸ step started";
    case "step_finish":
      return "[mimo] ■ step finished" + (part.reason ? ` (${part.reason})` : "");
    case "text": {
      const text = part.text;
      if (typeof text !== "string" || text.trim() === "") return null;
      return "[mimo] · " + firstLineTruncated(text, 80);
    }
    default: {
      if (typeof type === "string" && type.includes("tool")) {
        const name = part.tool || obj.name || obj.tool || "tool";
        const args = part.args && typeof part.args === "object" ? part.args : {};
        const target = part.path || part.file || args.path;
        const suffix = target ? " " + truncate(target, 60) : "";
        return "[mimo] ⚙ " + name + suffix;
      }
      if (typeof type === "string" && type !== "") return "[mimo] " + type;
      return "[mimo] " + line;
    }
  }
}

// `mimo run --variant <v>` selects provider-specific reasoning effort. It is not
// enumerable via the CLI, so we ship this static guidance list.
const VARIANTS = ["minimal", "low", "medium", "high", "max"];

// resolveModels: pure intersection of authenticated providers (parsed from the
// `providers list` box text) with available models (`models` plain text). The
// real `mimo` has no --json, so we parse raw TEXT. See Phase 0 discovery.
export function resolveModels({ providersRaw, modelsRaw }) {
  // eslint-disable-next-line no-control-regex
  const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

  const authenticatedProviders = [];
  for (const raw of stripAnsi(providersRaw).split("\n")) {
    // Anchor to line start: drop leading box-drawing glyphs/whitespace, then the
    // bullet must be the FIRST real glyph. This rejects `●` appearing mid-text
    // (e.g. a `legend: ● = active` footer) from minting phantom providers.
    const rest = raw.replace(/^[┌│└├─\s]*/, "");
    if (!rest.startsWith("●")) continue;
    // First whitespace-delimited token after the bullet is the display name.
    const name = rest.slice("●".length).trim().split(/\s+/)[0] || "";
    const provider = name.toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(provider)) continue;
    if (!authenticatedProviders.includes(provider)) authenticatedProviders.push(provider);
  }

  const authed = new Set(authenticatedProviders);
  const options = [];
  for (const line of modelsRaw.split("\n")) {
    const model = line.trim();
    if (!/^\S+\/\S+$/.test(model)) continue;
    const provider = model.slice(0, model.indexOf("/"));
    if (authed.has(provider)) options.push({ provider, model });
  }

  return { authenticatedProviders, options, variants: VARIANTS };
}

// Spawn `mimo <args>` and resolve with its full stdout, rejecting on non-zero exit.
function mimoStdout(mimoBin, args) {
  return new Promise((resolve, reject) => {
    execFile(mimoBin, args, { maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`\`mimo ${args.join(" ")}\` failed: ${stderr.trim() || err.message}`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function resolveModelsMain() {
  const mimoBin = process.env.MIMO_BIN || "mimo";
  const [providersRaw, modelsRaw] = await Promise.all([
    mimoStdout(mimoBin, ["providers", "list"]),
    mimoStdout(mimoBin, ["models"]),
  ]);
  const result = resolveModels({ providersRaw, modelsRaw });
  process.stdout.write(JSON.stringify(result) + "\n");
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
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    try { fs.unlinkSync(lockPath); } catch { /* best-effort */ }
  };
  process.on("exit", release);

  const childEnv = {
    ...process.env,
    MIMOCODE_CONFIG_CONTENT: buildConfigContent(process.env.MIMOCODE_CONFIG_CONTENT),
  };
  const child = spawn(mimoBin, mimoArgs, { cwd: args.cwd, env: childEnv, stdio: ["ignore", "pipe", "inherit"] });

  // process.on("exit") does NOT fire on signal termination. The host's run cap
  // kills us with SIGTERM, so release the lock and tear down the child here to
  // avoid a leaked lock + orphaned mimo.
  for (const sig of ["SIGTERM", "SIGINT"]) {
    process.on(sig, () => {
      try { child.kill("SIGTERM"); } catch { /* already gone */ }
      release();
      process.exit(sig === "SIGINT" ? 130 : 143);
    });
  }

  const log = fs.createWriteStream(logPath, { flags: "w" });
  let captured = args.resume; // on resume the id is already known/recorded

  const rl = readline.createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    const p = formatProgress(line);           // stdout: concise human-readable trace
    if (p !== null) process.stdout.write(p + "\n");
    log.write(line + "\n");                    // log: full raw NDJSON, unchanged
    if (!captured) {
      try {
        const obj = JSON.parse(line);
        if (obj && obj.sessionID) { writeAtomic(sidPath, String(obj.sessionID)); captured = true; }
      } catch { /* non-JSON line — ignore */ }
    }
  });

  // Exit only after BOTH the child has closed AND readline has drained every
  // buffered line — otherwise the last NDJSON line or the log tail can be lost,
  // and log.end() could race a pending write.
  let childExitCode = null;
  let childClosed = false;
  let rlClosed = false;
  const finish = () => {
    if (!childClosed || !rlClosed) return;
    log.end();
    release();
    process.exit(childExitCode == null ? 0 : childExitCode);
  };
  rl.on("close", () => { rlClosed = true; finish(); });

  child.on("error", (e) => {
    release();
    process.stderr.write(`mimo-run: spawn failed: ${e.message}\n`);
    process.exit(127);
  });
  child.on("close", (code, signal) => {
    childExitCode = code == null ? (signal ? 1 : 0) : code;
    childClosed = true;
    finish();
  });
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  // resolve-models is a sibling mode, not a forwarded arg: it shells out to
  // `mimo providers list` + `mimo models` and emits JSON. --json is accepted but
  // ignored (output is always JSON). parseArgs is reserved for the `run` path.
  const entry = process.argv[2] === "resolve-models" ? resolveModelsMain : main;
  entry().catch((e) => { process.stderr.write(`mimo-run: ${e.message}\n`); process.exit(2); });
}
