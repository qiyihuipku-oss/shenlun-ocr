import { ensureSchema, ownerIdFrom, runtimeEnv } from "../../../../lib/server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!runtimeEnv.DB || !runtimeEnv.UPLOADS) {
    return Response.json(
      { error: "当前是界面演示环境，尚未绑定私有对象存储" },
      { status: 503 },
    );
  }
  await ensureSchema();
  const { token } = await params;
  const record = await runtimeEnv.DB.prepare(
    "SELECT * FROM upload_tokens WHERE token = ? AND owner_id = ? LIMIT 1",
  )
    .bind(token, ownerIdFrom(request))
    .first<Record<string, string | number | null>>();

  if (!record || record.used_at || Date.parse(String(record.expires_at)) < Date.now()) {
    return Response.json({ error: "上传地址无效或已过期" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") || "";
  const body = await request.arrayBuffer();
  if (contentType !== record.content_type || body.byteLength > Number(record.max_bytes)) {
    return Response.json({ error: "图片类型或大小不符合要求" }, { status: 400 });
  }

  await runtimeEnv.UPLOADS.put(String(record.object_key), body, {
    httpMetadata: { contentType },
    customMetadata: {
      ownerId: ownerIdFrom(request),
      retentionUntil: new Date(Date.now() + 30 * 86400_000).toISOString(),
    },
  });
  await runtimeEnv.DB.prepare("UPDATE upload_tokens SET used_at = ? WHERE token = ?")
    .bind(new Date().toISOString(), token)
    .run();
  return Response.json({ objectKey: record.object_key }, { status: 201 });
}
