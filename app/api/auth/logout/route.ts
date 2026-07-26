import { clearSessionCookie } from "../../../../lib/auth-session";

export async function GET(request: Request) {
  const response = Response.redirect(new URL("/", request.url), 303);
  response.headers.append("Set-Cookie", clearSessionCookie());
  return response;
}
