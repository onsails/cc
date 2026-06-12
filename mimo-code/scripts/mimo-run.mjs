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
