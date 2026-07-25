import { ensureSchema, getSubmission, ownerIdFrom, runtimeEnv } from "../../../../lib/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const submission = await getSubmission(id, ownerIdFrom(request));
  if (!submission) return Response.json({ error: "未找到提交记录" }, { status: 404 });
  return Response.json({ submission });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!runtimeEnv.DB) return new Response(null, { status: 204 });
  await ensureSchema();
  const { id } = await params;
  const ownerId = ownerIdFrom(request);
  const row = await runtimeEnv.DB.prepare(
    "SELECT pages_json FROM submissions WHERE id = ? AND owner_id = ? LIMIT 1",
  )
    .bind(id, ownerId)
    .first<{ pages_json: string }>();
  if (!row) return Response.json({ error: "未找到提交记录" }, { status: 404 });
  const pages = JSON.parse(row.pages_json || "[]") as Array<{ key?: string }>;
  await Promise.all(pages.filter((page) => page.key).map((page) => runtimeEnv.UPLOADS?.delete(page.key!)));
  await runtimeEnv.DB.batch([
    runtimeEnv.DB.prepare("DELETE FROM transcript_revisions WHERE submission_id = ?").bind(id),
    runtimeEnv.DB.prepare("DELETE FROM submissions WHERE id = ? AND owner_id = ?").bind(id, ownerId),
  ]);
  return new Response(null, { status: 204 });
}
