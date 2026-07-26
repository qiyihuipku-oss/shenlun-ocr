import {
  authRuntimeEnv,
  createSessionToken,
  sessionCookie,
  verifyInviteCode,
} from "../../../../lib/auth-session";
import { safeRelativeReturnPath } from "../../../chatgpt-auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const inviteCode = String(form.get("inviteCode") || "").trim();
  const returnTo = safeRelativeReturnPath(String(form.get("returnTo") || "/app"));

  if (
    !authRuntimeEnv.APP_INVITE_CODE ||
    !authRuntimeEnv.APP_SESSION_SECRET
  ) {
    return redirectToLogin(request, returnTo, "config");
  }
  if (
    !inviteCode ||
    !(await verifyInviteCode(inviteCode, authRuntimeEnv.APP_INVITE_CODE))
  ) {
    return redirectToLogin(request, returnTo, "invalid");
  }

  const ownerId = `invite-${crypto.randomUUID()}`;
  const token = await createSessionToken(
    ownerId,
    authRuntimeEnv.APP_SESSION_SECRET,
  );
  const response = Response.redirect(new URL(returnTo, request.url), 303);
  response.headers.append("Set-Cookie", sessionCookie(token));
  return response;
}

function redirectToLogin(
  request: Request,
  returnTo: string,
  error: "config" | "invalid",
) {
  const url = new URL("/login", request.url);
  url.searchParams.set("return_to", returnTo);
  url.searchParams.set("error", error);
  return Response.redirect(url, 303);
}
