import { confirmSubmission, ownerIdFrom } from "../../../../../lib/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return Response.json(await confirmSubmission(id, ownerIdFrom(request)));
}
