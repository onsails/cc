import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs, stateDir, writeAtomic, acquireLock, isAlive, buildMimoArgs, buildConfigContent, PERMISSION_POLICY } from "../mimo-run.mjs";

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
    ["run", "--format", "json", "--session", "ses_xyz", "more"]
  );
  assert.deepEqual(
    buildMimoArgs({ resume: false, forward: ["-m", "x", "task"], sidPath: sid }),
    ["run", "--format", "json", "-m", "x", "task"]
  );
});

test("buildMimoArgs never passes --dangerously-skip-permissions", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mimo-skip-"));
  const sid = path.join(dir, "h.sessionid");
  fs.writeFileSync(sid, "ses_xyz\n");
  assert.ok(!buildMimoArgs({ resume: false, forward: ["task"], sidPath: sid }).includes("--dangerously-skip-permissions"));
  assert.ok(!buildMimoArgs({ resume: true, forward: ["task"], sidPath: sid }).includes("--dangerously-skip-permissions"));
});

test("buildConfigContent emits the permission policy, doom_loop omitted (stays ask)", () => {
  const cfg = JSON.parse(buildConfigContent(undefined));
  assert.deepEqual(cfg, { permission: PERMISSION_POLICY });
  assert.deepEqual(cfg.permission, { edit: "allow", bash: "allow", webfetch: "allow", external_directory: "allow" });
  // doom_loop deliberately absent → mimo keeps its default `ask` → headless auto-reject (the brake).
  assert.equal(cfg.permission.doom_loop, undefined);
});

test("buildConfigContent merges into an existing config: keeps other keys, our policy wins", () => {
  const existing = JSON.stringify({
    provider: { openai: { x: 1 } },
    permission: { doom_loop: "allow", external_directory: "deny", bash: { "rm -rf *": "deny" } },
  });
  const cfg = JSON.parse(buildConfigContent(existing));
  assert.deepEqual(cfg.provider, { openai: { x: 1 } });        // unrelated top-level key preserved
  assert.equal(cfg.permission.doom_loop, "allow");             // user permission key we don't set → preserved
  assert.equal(cfg.permission.external_directory, "allow");    // our policy wins on conflict
  assert.equal(cfg.permission.edit, "allow");
});

test("buildConfigContent ignores a non-JSON or array existing value", () => {
  assert.deepEqual(JSON.parse(buildConfigContent("not json {")), { permission: PERMISSION_POLICY });
  assert.deepEqual(JSON.parse(buildConfigContent("[1,2,3]")), { permission: PERMISSION_POLICY });
  assert.deepEqual(JSON.parse(buildConfigContent("")), { permission: PERMISSION_POLICY });
});
