import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("OCR contract exposes quality, candidates, decisions and corrections", async () => {
  const source = await readFile(new URL("../lib/types.ts", import.meta.url), "utf8");
  for (const name of ["ImageQuality", "OcrCandidate", "OcrDecision", "CorrectionEvent"]) {
    assert.match(source, new RegExp(`type ${name}`));
  }
  assert.match(source, /"quality_check"/);
  assert.match(source, /requiresReview/);
  assert.match(source, /consentScope/);
});

test("anonymous API fallback is removed", async () => {
  const server = await readFile(new URL("../lib/server.ts", import.meta.url), "utf8");
  assert.match(server, /AuthenticationRequiredError/);
  assert.doesNotMatch(server, /invite-demo-user|x-demo-user/);
});

test("Baidu adapter parses line coordinates without a fabricated fixed score", async () => {
  const provider = await readFile(new URL("../lib/providers.ts", import.meta.url), "utf8");
  assert.match(provider, /content\?\.lines/);
  assert.match(provider, /confidenceSource/);
  assert.match(provider, /heuristicLineConfidence/);
  assert.doesNotMatch(provider, /confidence:\s*0\.9/);
});
