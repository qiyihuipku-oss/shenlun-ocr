import { apiError, ensureSchema, newId, requireOwnerId, runtimeEnv } from "../../../../lib/server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
  const ownerId = await requireOwnerId(request);
  const input = (await request.json()) as { filename?: string; contentType?: string; size?: number };
  const contentType = input.contentType || "";
  const size = Number(input.size || 0);
  if (!allowedTypes.has(contentType)) {
    return Response.json({ error: "仅支持 JPG、PNG、WebP 图片" }, { status: 400 });
  }
  if (!size || size > maxBytes) {
    return Response.json({ error: "单页图片不得超过 10MB" }, { status: 400 });
  }

  const token = newId("upload");
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const objectKey = `answers/${ownerId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();

  if (runtimeEnv.DB) {
    await ensureSchema();
    await runtimeEnv.DB.prepare(`
      INSERT INTO upload_tokens
      (token, owner_id, object_key, content_type, max_bytes, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(token, ownerId, objectKey, contentType, maxBytes, expiresAt, now.toISOString())
      .run();
  }

  return Response.json({
    token,
    objectKey,
    uploadUrl: `/api/uploads/${token}`,
    method: "PUT",
    expiresAt,
  });
  } catch (error) {
    return apiError(error);
  }
}
