import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const SESSION_NAME = "dazzle_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours
const SESSION_VERSION = "v2";

// =============================================================================
// 세션 토큰
//   형식: v2.<base64url(JSON payload)>.<base64url(HMAC-SHA256)>
//   payload:
//     - 공용 비밀번호 로그인 : { sub: "admin", iat, exp }
//     - 캘린더(직원) 로그인 : { sub: "staff", uid, loginId, ver, iat, exp }
//         uid / ver 는 dazzle-home 브로커(verify-staff)가 돌려준 uid / session_version.
//
//   서명 키 (실패 시 닫힘 — fail closed):
//     1) LINKS_SESSION_SECRET                                  (권장, 임의의 긴 랜덤 문자열)
//     2) 없으면 "dazzle_links_session_v2:" + SUPABASE_SERVICE_ROLE_KEY (서버 전용 키, 앱 단위 스코프)
//     3) 둘 다 없으면 키 없음 → 토큰 발급 불가(로그인 500), 모든 세션 검증 실패.
//   ※ 이전의 SHA-256(ADMIN_PASSWORD) 폴백은 제거됨 — 비밀번호 유출 = 세션 위조 가능이었음.
//
//   이 모듈은 middleware(Edge) 와 라우트 핸들러(Node) 양쪽에서 import 되므로
//   Web Crypto(crypto.subtle) 만 사용하고 Node 전용 모듈/“server-only” 를 넣지 않는다.
//
//   검증 계층 (두 겹):
//     - src/middleware.ts   : verifySessionFromRequest() — 서명 + 만료만 확인하는 1차 관문(Edge).
//     - 라우트 핸들러       : src/lib/session-server.ts 의 getVerifiedSession() — 서명/만료에 더해
//                             staff 세션은 브로커(staff-status)로 계정 상태를 재확인한다. 이쪽이 최종 권한.
// =============================================================================
export type AdminSessionPayload = { sub: "admin"; iat: number; exp: number };
export type StaffSessionPayload = {
  sub: "staff";
  uid: string;
  loginId: string;
  ver: number | string;
  iat: number;
  exp: number;
};
export type SessionPayload = AdminSessionPayload | StaffSessionPayload;

// createSession* 에 넘기는 발급 명세 (iat/exp 는 내부에서 채움)
export type SessionSpec =
  | { sub: "admin" }
  | { sub: "staff"; uid: string; loginId: string; ver: number | string };

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

// 서명 키 재료. 없으면 null (fail closed).
function getSecretMaterial(): string | null {
  const secret = process.env.LINKS_SESSION_SECRET;
  if (secret) return secret;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) return "dazzle_links_session_v2:" + serviceKey;
  return null;
}

let keyPromise: Promise<CryptoKey | null> | null = null;
let warnedMissingSecret = false;

async function getSigningKey(): Promise<CryptoKey | null> {
  if (!keyPromise) {
    keyPromise = (async () => {
      const material = getSecretMaterial();
      if (!material) {
        if (!warnedMissingSecret) {
          warnedMissingSecret = true;
          console.error(
            "[auth] session secret is not configured — set LINKS_SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY). " +
              "All sessions are rejected and login returns 500 until it is set."
          );
        }
        return null;
      }
      return crypto.subtle.importKey(
        "raw",
        encoder.encode(material),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
      );
    })();
    // 키 재료가 없어 null 이면 다음 호출에서 다시 시도할 수 있게 캐시하지 않는다.
    keyPromise.then((k) => { if (!k) keyPromise = null; }, () => { keyPromise = null; });
  }
  return keyPromise;
}

// 세션 시크릿이 설정되어 있는지 (로그인 라우트가 500 "세션 시크릿 미설정" 을 내기 위한 확인용)
export function hasSessionSecret(): boolean {
  return getSecretMaterial() !== null;
}

export async function createSessionToken(spec: SessionSpec): Promise<string | null> {
  const key = await getSigningKey();
  if (!key) return null;
  const iat = Math.floor(Date.now() / 1000);
  const payload: SessionPayload =
    spec.sub === "admin"
      ? { sub: "admin", iat, exp: iat + SESSION_MAX_AGE }
      : { sub: "staff", uid: spec.uid, loginId: spec.loginId, ver: spec.ver, iat, exp: iat + SESSION_MAX_AGE };
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${SESSION_VERSION}.${body}`;
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(sig))}`;
}

// 서명 + 만료 + 페이로드 형태만 검증한다. 계정 상태(정지/퇴사/비밀번호 변경)는 확인하지 않으므로
// 라우트 핸들러에서는 반드시 session-server.ts 의 getVerifiedSession() 을 사용할 것.
export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token || token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== SESSION_VERSION) return null;
  const [version, body, sig] = parts;
  const key = await getSigningKey();
  if (!key) return null;
  const sigBytes = base64UrlDecode(sig);
  const bodyBytes = base64UrlDecode(body);
  if (!sigBytes || !bodyBytes) return null;
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(`${version}.${body}`));
  if (!valid) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(bodyBytes));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const { sub, iat, exp, uid, loginId, ver } = payload as Record<string, unknown>;
  if (typeof iat !== "number" || typeof exp !== "number") return null;
  const now = Math.floor(Date.now() / 1000);
  if (exp <= now || iat > now + 60) return null;

  if (sub === "admin") return { sub: "admin", iat, exp };
  if (sub === "staff") {
    if (typeof uid !== "string" || !uid || typeof loginId !== "string") return null;
    if (typeof ver !== "number" && typeof ver !== "string") return null;
    return { sub: "staff", uid, loginId, ver, iat, exp };
  }
  return null;
}

// 세션 쿠키 발급. 서명 키를 만들 수 없으면(시크릿 미설정) false.
export async function createSession(spec: SessionSpec): Promise<boolean> {
  const token = await createSessionToken(spec);
  if (!token) return false;
  const cookieStore = await cookies();
  cookieStore.set(SESSION_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return true;
}

// 쿠키에서 페이로드 읽기 (서명/만료만). 라우트 핸들러의 권한 판단에는 getVerifiedSession() 을 쓸 것.
export async function readSessionPayload(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_NAME);
  return verifySessionToken(session?.value);
}

// middleware(Edge) 전용 1차 관문 — 서명 + 만료만 확인.
export async function verifySessionFromRequest(request: NextRequest): Promise<boolean> {
  const session = request.cookies.get(SESSION_NAME);
  return (await verifySessionToken(session?.value)) !== null;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_NAME);
}

// Rate limiting: simple in-memory store — 2차 필터.
// 1차(권위) 제한은 DB 기반 src/lib/auth-throttle.ts (auth_throttle 테이블) 가 담당한다.
// 한계: Vercel 서버리스/Edge 는 인스턴스별로 이 Map 이 따로 존재하므로 인스턴스 간
// 카운트가 공유되지 않고, 인스턴스가 재활용되면 초기화된다. 즉 이 제한은 단일
// 인스턴스 안에서의 무차별 대입만 늦춘다 (DB throttle 의 인스턴스별 2차 필터 — 권위는 src/lib/auth-throttle.ts).
// route.ts 는 비밀번호 비교 "전에" isRateLimited() 를 확인한다 (차단 중이면 정답도 검사하지 않음).
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
