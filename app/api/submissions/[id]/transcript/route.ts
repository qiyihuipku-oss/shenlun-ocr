import { apiError, requireOwnerId, saveTranscript } from "../../../../../lib/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const input = (await request.json()) as {
    transcript?: string;
    blockId?: string;
    acceptedSuggestion?: string;
  };
  const transcript = input.transcript?.trim() || "";
  if (!transcript) return Response.json({ error: "电子稿不能为空" }, { status: 400 });
  if (transcript.length > 20_000) {
    return Response.json({ error: "电子稿长度超出首版限制" }, { status: 400 });
  }
  const { id } = await params;
  return Response.json(await saveTranscript(id, await requireOwnerId(request), transcript, input));
  } catch (error) {
    return apiError(error);
  }
}
