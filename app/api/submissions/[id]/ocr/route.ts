import { startOcrRun } from "../../../../../lib/ocr-service";
import { apiError, requireOwnerId } from "../../../../../lib/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await startOcrRun(id, await requireOwnerId(request));
    return Response.json(result, { status: result.idempotent ? 200 : 202 });
  } catch (error) {
    return apiError(error);
  }
}
