import { env } from "cloudflare:workers";

export const SESSION_COOKIE_NAME = "shenlun_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

type AuthRuntimeEnv = {
  APP_INVITE_CODE?: string;
  APP_SESSION_SECRET?: string;
};

export const authRuntimeEnv = env as unknown as AuthRuntimeEnv;

type SessionPayload = {
  sub: string;
  exp: number;
};

export async function createSessionToken(
  ownerId: string,
  secret: string,
): Promise<string> {
  const payload = toBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        sub: ownerId,
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      } satisfies SessionPayload),
    ),
  );
  const signature = await sign(payload, secret);
  return `${payload}.${toBase64Url(signature)}`;
}

export async function verifySessionToken(
  token: string | null,
  secret: string | undefined,
): Promise<string | null> {
  if (!token || !secret) return null;
  const [payload, encodedSignature, extra] = token.split(".");
  if (!payload || !encodedSignature || extra) return null;

  try {
    const key = await importHmacKey(secret, ["verify"]);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(encodedSignature),
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;
    const parsed = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payload)),
    ) as Partial<SessionPayload>;
    if (
      typeof parsed.sub !== "string" ||
      !parsed.sub.startsWith("invite-") ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return parsed.sub;
  } catch {
    return null;
  }
}

export async function verifyInviteCode(
  provided: string,
  expected: string | undefined,
): Promise<boolean> {
  if (!expected) return false;
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const providedBytes = new Uint8Array(providedHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= providedBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

export function readCookie(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=") || null;
  }
  return null;
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function sign(value: string, secret: string): Promise<ArrayBuffer> {
  const key = await importHmacKey(secret, ["sign"]);
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
}

async function importHmacKey(
  secret: string,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of array) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function fromBase64Url(value: string): ArrayBuffer {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0),
  ).buffer;
}
