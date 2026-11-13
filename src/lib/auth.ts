import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "r2_vault_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("SESSION_SECRET must be set to a random value of at least 32 bytes.");
  }
  return secret;
}

export function createSessionToken() {
  const issuedAt = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", getSessionSecret()).update(issuedAt).digest("base64url");
  return `${issuedAt}.${signature}`;
}

export function verifySessionToken(token: string | undefined) {
  if (!token) return false;
  const [issuedAt, signature, extra] = token.split(".");
  if (!issuedAt || !signature || extra || !/^\d+$/.test(issuedAt)) return false;

  const issuedAtSeconds = Number(issuedAt);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(issuedAtSeconds) || issuedAtSeconds > now + 60 || now - issuedAtSeconds >= SESSION_TTL_SECONDS) {
    return false;
  }

  const expected = createHmac("sha256", getSessionSecret()).update(issuedAt).digest("base64url");
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function hasValidSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export function isCorrectPassword(password: string) {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword || configuredPassword.length < 12) {
    throw new Error("ADMIN_PASSWORD must be set to a password of at least 12 characters.");
  }

  const supplied = createHash("sha256").update(password).digest();
  const expected = createHash("sha256").update(configuredPassword).digest();
  return timingSafeEqual(supplied, expected);
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
