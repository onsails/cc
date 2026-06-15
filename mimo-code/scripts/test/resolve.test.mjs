import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveModels } from "../mimo-run.mjs";

const ESC = "\x1b";
const PROVIDERS_RAW = [
  "┌ Credentials",
  `│  ${ESC}[32m●${ESC}[0m  ${ESC}[1mOpenAI${ESC}[0m oauth`,
  "│  ●  Xiaomi oauth",
  "└ 2 credentials",
].join("\n");

const MODELS_RAW = [
  "mimo/mimo-auto",
  "openai/gpt-5.4",
  "openai/gpt-5.4-fast",
  "xiaomi/mimo-v2.5-pro",
  "anthropic/claude-x",
].join("\n");

test("resolveModels intersects authed providers with models and lists variants", () => {
  const r = resolveModels({ providersRaw: PROVIDERS_RAW, modelsRaw: MODELS_RAW });
  assert.deepEqual(r.authenticatedProviders, ["openai", "xiaomi"]);
  assert.deepEqual(r.variants, ["minimal", "low", "medium", "high", "max"]);

  assert.ok(r.options.some((o) => o.provider === "openai" && o.model === "openai/gpt-5.4"));
  assert.ok(r.options.some((o) => o.provider === "xiaomi" && o.model === "xiaomi/mimo-v2.5-pro"));
  // unauthenticated provider excluded
  assert.ok(!r.options.some((o) => o.provider === "anthropic"));
  assert.ok(!r.options.some((o) => o.provider === "mimo"));
});

test("resolveModels returns empty when no providers are authenticated", () => {
  const r = resolveModels({
    providersRaw: "┌ Credentials\n└ 0 credentials",
    modelsRaw: MODELS_RAW,
  });
  assert.deepEqual(r.authenticatedProviders, []);
  assert.deepEqual(r.options, []);
});
