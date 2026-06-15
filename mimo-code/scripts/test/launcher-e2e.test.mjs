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

test("fresh delegate captures the session id and emits concise progress", () => {
  const state = freshState();
  const res = runLauncher(["--handle", "h1", "--cwd", process.cwd(), "--", "build it"], state);
  assert.equal(res.status, 0, res.stderr);
  // stdout is the concise human-readable progress trace, not raw NDJSON.
  assert.match(res.stdout, /\[mimo\] ■ step finished \(stop\)/);
  assert.match(res.stdout, /\[mimo\] ⚙ edit src\/a\.ts/);
  assert.match(res.stdout, /\[mimo\] · working/);
  assert.doesNotMatch(res.stdout, /"sessionID"/);
  // the full raw NDJSON still lands in the .ndjson log, sessionID included.
  const dir = stateFileDir(state);
  const ndjson = fs.readFileSync(path.join(dir, "h1.ndjson"), "utf8");
  assert.match(ndjson, /"sessionID":"ses_fake"/);
  assert.match(ndjson, /"text":"working"/);
  assert.equal(fs.readFileSync(path.join(dir, "h1.sessionid"), "utf8"), "ses_fake");
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

test("resolve-models prints intersected models as JSON", () => {
  const state = freshState();
  const res = runLauncher(["resolve-models", "--json"], state);
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.ok(out.authenticatedProviders.includes("openai"), res.stdout);
  assert.ok(out.options.some((o) => o.model.startsWith("openai/")), res.stdout);
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
