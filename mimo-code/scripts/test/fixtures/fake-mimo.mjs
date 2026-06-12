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
