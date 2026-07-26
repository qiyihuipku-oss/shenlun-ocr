import { apiError, confirmSubmission, requireOwnerId } from "../../../../../lib/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const { id } = await params;
  return Response.json(await confirmSubmission(id, await requireOwnerId(request)));
  } catch (error) {
    return apiError(error);
  }
}
