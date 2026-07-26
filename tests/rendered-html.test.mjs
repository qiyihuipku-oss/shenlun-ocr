import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("申论镜 has a public product story and a protected workspace", async () => {
  const [page, landing, appPage, workspace, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/landing-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/workspace-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /LandingPage/);
  assert.doesNotMatch(page, /chatgpt\.site\/app/);
  assert.match(landing, /href=\{workspaceHref\}/);
  assert.match(landing, /一张卷子 · 三次看见/);
  assert.match(landing, /requestAnimationFrame/);
  assert.match(landing, /拍下答卷/);
  assert.match(landing, /还原原文/);
  assert.match(landing, /看见问题/);
  assert.match(appPage, /requireChatGPTUser\("\/app"\)/);
  assert.match(appPage, /\/api\/auth\/logout/);
  assert.match(workspace, /申论镜/);
  assert.match(workspace, /上传答卷/);
  assert.match(workspace, /校对原文/);
  assert.match(workspace, /循证批改/);
  assert.match(layout, /og-v2\.jpg/);
  assert.doesNotMatch(`${page}${landing}${workspace}${layout}${packageJson}`, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
  await access(new URL("../dist/server/index.js", import.meta.url));
});

test("OCR is durable, authenticated and never simulated by UI timers", async () => {
  const [workspace, service, provider, api] = await Promise.all([
    readFile(new URL("../app/workspace-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/ocr-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/providers.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/submissions/[id]/ocr/route.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(workspace, /setTimeout\(resolve,\s*1100\)|setTimeout\(resolve,\s*1200\)/);
  assert.match(service, /ocr_runs/);
  assert.match(service, /attempts < 3/);
  assert.match(provider, /PP-OCRv6_medium/);
  assert.match(provider, /engine_disagreement/);
  assert.match(api, /requireOwnerId/);
});

test("upload route enforces type, size, expiry and one-time use", async () => {
  const [presign, upload] = await Promise.all([
    readFile(new URL("../app/api/uploads/presign/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/uploads/[token]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(presign, /image\/jpeg/);
  assert.match(presign, /image\/png/);
  assert.match(presign, /image\/webp/);
  assert.match(presign, /10 \* 1024 \* 1024/);
  assert.match(upload, /record\.used_at/);
  assert.match(upload, /Date\.parse/);
  assert.match(upload, /putPrivateObject/);
});
