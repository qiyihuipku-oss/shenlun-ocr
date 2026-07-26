import { startOcrRun } from "../../../../../../lib/ocr-service";
import { apiError, requireOwnerId } from "../../../../../../lib/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const input = (await request.json()) as { page?: number; blockId?: string };
    if (!input.page && !input.blockId) {
      return Response.json({ error: "page 或 blockId 至少提供一项" }, { status: 400 });
    }
    const { id } = await params;
    const result = await startOcrRun(id, await requireOwnerId(request), input);
    return Response.json(result, { status: result.idempotent ? 200 : 202 });
  } catch (error) {
    return apiError(error);
  }
}
