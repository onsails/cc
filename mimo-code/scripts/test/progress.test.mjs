import { test } from "node:test";
import assert from "node:assert/strict";
import { formatProgress } from "../mimo-run.mjs";

test("step_start renders a concise marker", () => {
  assert.equal(formatProgress(JSON.stringify({ type: "step_start" })), "[mimo] ▸ step started");
});

test("step_finish appends the reason when present", () => {
  assert.equal(
    formatProgress(JSON.stringify({ type: "step_finish", part: { reason: "stop" } })),
    "[mimo] ■ step finished (stop)"
  );
  assert.equal(
    formatProgress(JSON.stringify({ type: "step_finish" })),
    "[mimo] ■ step finished"
  );
});

test("tool_use shows the tool name and a truncated target", () => {
  assert.equal(
    formatProgress(JSON.stringify({ type: "tool_use", part: { tool: "edit", path: "src/a.ts" } })),
    "[mimo] ⚙ edit src/a.ts"
  );
  // falls back through name/tool, defaults to "tool"
  assert.equal(
    formatProgress(JSON.stringify({ type: "tool", name: "bash" })),
    "[mimo] ⚙ bash"
  );
  assert.equal(formatProgress(JSON.stringify({ type: "tool_use" })), "[mimo] ⚙ tool");
  // long target is truncated to ~60 chars
  const longPath = "a".repeat(200);
  const out = formatProgress(JSON.stringify({ type: "tool_use", part: { tool: "read", path: longPath } }));
  assert.ok(out.startsWith("[mimo] ⚙ read "));
  assert.ok(out.length < "[mimo] ⚙ read ".length + 70, out);
});

test("text with content is first-line truncated", () => {
  assert.equal(
    formatProgress(JSON.stringify({ type: "text", part: { text: "working" } })),
    "[mimo] · working"
  );
  const long = "x".repeat(200) + "\nsecond line";
  const out = formatProgress(JSON.stringify({ type: "text", part: { text: long } }));
  assert.ok(out.startsWith("[mimo] · "));
  assert.ok(!out.includes("second line"), out);
  assert.ok(out.length < "[mimo] · ".length + 90, out);
});

test("empty text is suppressed", () => {
  assert.equal(formatProgress(JSON.stringify({ type: "text", part: { text: "" } })), null);
  assert.equal(formatProgress(JSON.stringify({ type: "text" })), null);
});

test("unknown type echoes the type", () => {
  assert.equal(formatProgress(JSON.stringify({ type: "weird_event" })), "[mimo] weird_event");
});

test("non-JSON line passes through prefixed", () => {
  assert.equal(formatProgress("note: building"), "[mimo] note: building");
});

test("blank line is suppressed", () => {
  assert.equal(formatProgress(""), null);
  assert.equal(formatProgress("   "), null);
});

test("missing fields do not throw", () => {
  assert.doesNotThrow(() => formatProgress(JSON.stringify({})));
  assert.doesNotThrow(() => formatProgress(JSON.stringify({ type: "tool_use", part: null })));
});
