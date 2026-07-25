import { createSubmission, ensureSchema, ownerIdFrom, runtimeEnv } from "../../../lib/server";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ submissions: [] });
  await ensureSchema();
  const rows = await runtimeEnv.DB.prepare(`
    SELECT id, question_id, status, transcript, report_json, created_at, updated_at
    FROM submissions WHERE owner_id = ? ORDER BY created_at DESC LIMIT 30
  `)
    .bind(ownerIdFrom(request))
    .all();
  return Response.json({ submissions: rows.results });
}

export async function POST(request: Request) {
  const input = (await request.json()) as {
    questionId?: string;
    pages?: Array<{ key: string; order: number; rotation?: number }>;
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
  const submission = await createSubmission(ownerIdFrom(request), {
    questionId: input.questionId,
    pages: [...input.pages].sort((a, b) => a.order - b.order),
  });
  return Response.json({ submission }, { status: 201 });
}
