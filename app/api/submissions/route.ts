import { apiError, createSubmission, ensureSchema, requireOwnerId, runtimeEnv } from "../../../lib/server";

export async function GET(request: Request) {
  try {
    const ownerId = await requireOwnerId(request);
    if (!runtimeEnv.DB) return Response.json({ submissions: [] });
    await ensureSchema();
    const rows = await runtimeEnv.DB.prepare(`
      SELECT id, question_id, status, transcript, report_json, created_at, updated_at
      FROM submissions WHERE owner_id = ? ORDER BY created_at DESC LIMIT 30
    `).bind(ownerId).all();
    return Response.json({ submissions: rows.results });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const input = (await request.json()) as {
    questionId?: string;
    pages?: Array<{
      key: string;
      originalKey?: string;
      normalizedKey?: string;
      order: number;
      rotation?: number;
    }>;
    quality?: Array<Record<string, unknown>>;
  };
  if (!input.questionId || !input.pages?.length) {
    return Response.json({ error: "questionId 和 pages 必填" }, { status: 400 });
  }
  if (input.pages.length > 8) {
    return Response.json({ error: "首版最多上传 8 页" }, { status: 400 });
  }
  const uniqueOrders = new Set(input.pages.map((page) => page.order));
  if (uniqueOrders.size !== input.pages.length) {
    return Response.json({ error: "页面顺序不能重复" }, { status: 400 });
  }
  try {
    const submission = await createSubmission(await requireOwnerId(request), {
      questionId: input.questionId,
      pages: [...input.pages].sort((a, b) => a.order - b.order),
      quality: input.quality as never,
    });
    return Response.json({ submission }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
