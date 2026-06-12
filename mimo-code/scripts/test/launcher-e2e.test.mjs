import { test, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const launcher = path.join(here, "..", "mimo-run.mjs");
const fakeMimo = path.join(here, "fixtures", "fake-mimo.mjs");

before(() => { fs.chmodSync(fakeMimo, 0o755); });

function freshState() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mimo-e2e-"));
}
function runLauncher(args, state, extraEnv = {}) {
  const env = { ...process.env, MIMO_BIN: fakeMimo, XDG_STATE_HOME: state, ...extraEnv };
  return spawnSync(process.execPath, [launcher, ...args], { env, encoding: "utf8" });
}
function stateFileDir(state) {
  const root = path.join(state, "mimo-code");
  return path.join(root, fs.readdirSync(root)[0]);
}

test("fresh delegate captures the session id and streams output", () => {
  const state = freshState();
  const res = runLauncher(["--handle", "h1", "--cwd", process.cwd(), "--", "build it"], state);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /"sessionID":"ses_fake"/);
  assert.match(res.stdout, /"text":"working"/);
  assert.equal(fs.readFileSync(path.join(stateFileDir(state), "h1.sessionid"), "utf8"), "ses_fake");
});

test("resume reads the sidecar and forwards --session", () => {
  const state = freshState();
  const first = runLauncher(["--handle", "h1", "--cwd", process.cwd(), "--", "first"], state);
  assert.equal(first.status, 0, first.stderr);
  const dir = stateFileDir(state);
  const sid = fs.readFileSync(path.join(dir, "h1.sessionid"), "utf8");
  const argsOut = path.join(freshState(), "argv.json");
  const r2 = runLauncher(["--handle", "h1", "--cwd", process.cwd(), "--resume", "--", "more"], state, { FAKE_MIMO_ARGS_OUT: argsOut });
  assert.equal(r2.status, 0, r2.stderr);
  const forwarded = JSON.parse(fs.readFileSync(argsOut, "utf8"));
  assert.ok(forwarded.includes("--session"));
  assert.equal(forwarded[forwarded.indexOf("--session") + 1], sid);
});

test("resume without a sidecar fails clearly", () => {
  const state = freshState();
  const res = runLauncher(["--handle", "ghost", "--cwd", process.cwd(), "--resume", "--", "x"], state);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /no recorded session/);
});

test("bad session exits non-zero and does not overwrite the sidecar", () => {
  const state = freshState();
  runLauncher(["--handle", "h2", "--cwd", process.cwd(), "--", "first"], state);
  const dir = stateFileDir(state);
  fs.writeFileSync(path.join(dir, "h2.sessionid"), "badid");
  const r2 = runLauncher(["--handle", "h2", "--cwd", process.cwd(), "--resume", "--", "x"], state);
  assert.equal(r2.status, 1);
  assert.match(r2.stderr, /badid not found/);
  assert.equal(fs.readFileSync(path.join(dir, "h2.sessionid"), "utf8"), "badid");
});
