import { advanceOcrRun } from "../../../../lib/ocr-service";
import { apiError, ensureSchema, getSubmission, requireOwnerId, runtimeEnv } from "../../../../lib/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const { id } = await params;
  const ownerId = requireOwnerId(request);
  const current = await getSubmission(id, ownerId);
  const submission = current && ["ocr_pending", "ocr_processing"].includes(current.status)
    ? await advanceOcrRun(id, ownerId)
    : current;
  if (!submission) return Response.json({ error: "未找到提交记录" }, { status: 404 });
  return Response.json({ submission });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const ownerId = requireOwnerId(request);
  if (!runtimeEnv.DB) return new Response(null, { status: 204 });
  await ensureSchema();
  const { id } = await params;
  const row = await runtimeEnv.DB.prepare(
    "SELECT pages_json FROM submissions WHERE id = ? AND owner_id = ? LIMIT 1",
  )
    .bind(id, ownerId)
    .first<{ pages_json: string }>();
  if (!row) return Response.json({ error: "未找到提交记录" }, { status: 404 });
  const pages = JSON.parse(row.pages_json || "[]") as Array<{
    key?: string;
    originalKey?: string;
    normalizedKey?: string;
  }>;
  const objectKeys = [...new Set(pages.flatMap((page) =>
    [page.key, page.originalKey, page.normalizedKey].filter((key): key is string => !!key),
  ))];
  await Promise.all(objectKeys.map((key) => runtimeEnv.UPLOADS?.delete(key)));
  await runtimeEnv.DB.batch([
    runtimeEnv.DB.prepare("DELETE FROM transcript_revisions WHERE submission_id = ?").bind(id),
    runtimeEnv.DB.prepare("DELETE FROM correction_events WHERE submission_id = ? AND owner_id = ?").bind(id, ownerId),
    runtimeEnv.DB.prepare("DELETE FROM ocr_candidates WHERE submission_id = ?").bind(id),
    runtimeEnv.DB.prepare("DELETE FROM ocr_runs WHERE submission_id = ? AND owner_id = ?").bind(id, ownerId),
    runtimeEnv.DB.prepare("DELETE FROM quality_checks WHERE submission_id = ?").bind(id),
    runtimeEnv.DB.prepare("DELETE FROM submissions WHERE id = ? AND owner_id = ?").bind(id, ownerId),
  ]);
  return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
