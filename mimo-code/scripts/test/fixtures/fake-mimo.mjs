#!/usr/bin/env node
// Stand-in for `mimo`. Handles three argv shapes:
// - `providers list ...` → ANSI-colored box text listing authenticated (●) providers, exit 0
// - `models ...`         → plain `provider/model` lines (authed + unauthed), exit 0
// - `run --format json --dangerously-skip-permissions [--session <id>] [...]`:
//   - records its argv to FAKE_MIMO_ARGS_OUT (if set) for assertions
//   - `--session badid` → emit nothing, error on stderr, exit 1 (bad/unknown session)
//   - otherwise emit 3 NDJSON lines carrying a sessionID, exit 0
import fs from "node:fs";
import process from "node:process";

const argv = process.argv.slice(2);

if (argv[0] === "providers" && argv[1] === "list") {
  // Mimic the real ANSI-colored box-drawing output. ANSI on the OpenAI line
  // proves the launcher's stripper works before token extraction.
  const ESC = "\x1b";
  process.stdout.write("┌ Credentials\n");
  process.stdout.write(`│  ${ESC}[32m●${ESC}[0m  ${ESC}[1mOpenAI${ESC}[0m oauth\n`);
  process.stdout.write("│  ●  Xiaomi oauth\n");
  process.stdout.write("└ 2 credentials\n");
  process.exit(0);
}

if (argv[0] === "models") {
  process.stdout.write("mimo/mimo-auto\n");
  process.stdout.write("openai/gpt-5.4\n");
  process.stdout.write("openai/gpt-5.4-fast\n");
  process.stdout.write("xiaomi/mimo-v2.5-pro\n");
  process.stdout.write("anthropic/claude-x\n");
  process.exit(0);
}

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
