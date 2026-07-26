import { apiError, gradeSubmission, requireOwnerId } from "../../../../../lib/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const { id } = await params;
  const report = await gradeSubmission(id, await requireOwnerId(request));
  return Response.json({ report });
  } catch (error) {
    return apiError(error);
  }
}
