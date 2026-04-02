import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const SESSION_NAME = "dazzle_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours

function getSessionToken(): string {
  const password = process.env.ADMIN_PASSWORD || "";
  // Simple hash-like token derived from password + secret
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "__dazzle_salt_2024__");
  let hash = 0;
  for (const byte of data) {
    hash = ((hash << 5) - hash + byte) | 0;
  }
  return Math.abs(hash).toString(36) + "x" + password.length.toString(36);
}

export async function createSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_NAME, getSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function verifySession(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_NAME);
  if (!session) return false;
  return session.value === getSessionToken();
}

export function verifySessionFromRequest(request: NextRequest): boolean {
  const session = request.cookies.get(SESSION_NAME);
  if (!session) return false;
  return session.value === getSessionToken();
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_NAME);
}

// Rate limiting: simple in-memory store
const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = attempts.get(ip);

  if (record && record.resetAt > now) {
    if (record.count >= 5) return false; // blocked
    record.count++;
    return true;
  }

  // Reset after 15 minutes
  attempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  return true;
}
