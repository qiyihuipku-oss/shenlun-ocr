import { gradeSubmission, ownerIdFrom } from "../../../../../lib/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const report = await gradeSubmission(id, ownerIdFrom(request));
  return Response.json({ report });
}
