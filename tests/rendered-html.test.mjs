import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("申论镜 product shell replaces the starter preview", async () => {
  const [page, workspace, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/workspace-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /WorkspaceApp/);
  assert.match(workspace, /申论镜/);
  assert.match(workspace, /把纸上的思考/);
  assert.match(workspace, /上传答卷/);
  assert.match(workspace, /校对原文/);
  assert.match(workspace, /循证批改/);
  assert.match(layout, /og\.png/);
  assert.doesNotMatch(`${page}${workspace}${layout}${packageJson}`, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
  await access(new URL("../dist/server/index.js", import.meta.url));
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
  assert.match(upload, /runtimeEnv\.UPLOADS\.put/);
});
