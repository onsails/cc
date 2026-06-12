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
  acquireLock(lock, process.pid);
  assert.throws(() => acquireLock(lock, process.pid), /handle busy/);
  fs.writeFileSync(lock, "999999");
  assert.doesNotThrow(() => acquireLock(lock, process.pid));
});

test("buildMimoArgs injects --session on resume and fails without a sidecar", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mimo-ba-"));
  const sid = path.join(dir, "h.sessionid");
  assert.throws(() => buildMimoArgs({ resume: true, forward: [], sidPath: sid }), /no recorded session/);
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
