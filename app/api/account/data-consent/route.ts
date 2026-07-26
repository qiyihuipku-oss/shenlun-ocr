import { apiError, requireOwnerId, setDataConsent } from "../../../../lib/server";

export async function PATCH(request: Request) {
  try {
    const input = (await request.json()) as { scope?: "none" | "evaluation" | "improvement" };
    if (!input.scope || !["none", "evaluation", "improvement"].includes(input.scope)) {
      return Response.json({ error: "授权范围无效" }, { status: 400 });
    }
    return Response.json(await setDataConsent(await requireOwnerId(request), input.scope));
  } catch (error) {
    return apiError(error);
  }
}
