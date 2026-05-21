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

// Rate limiting: simple in-memory store.
// 주의: Vercel 서버리스는 인스턴스별로 이 Map이 따로 존재하므로 인스턴스 간
// 카운트가 공유되지 않는다. 따라서 "실패한 시도만" 카운트하고, 비밀번호가
// 맞으면 레이트리밋과 무관하게 항상 통과시킨다(아래 route.ts 참고).
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15분
const RATE_MAX_FAILS = 10; // 15분 내 실패 허용 횟수
const attempts = new Map<string, { count: number; resetAt: number }>();

// 로그인 실패 시에만 호출 — 실패 횟수 1 증가
export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = attempts.get(ip);
  if (record && record.resetAt > now) {
    record.count++;
  } else {
    attempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
  }
}

// 현재 IP가 실패 횟수 초과로 차단 상태인지 확인 (카운트 증가 없음)
export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || record.resetAt <= now) return false;
  return record.count >= RATE_MAX_FAILS;
}

// 로그인 성공 시 호출 — 실패 기록 초기화
export function clearAttempts(ip: string): void {
  attempts.delete(ip);
}
