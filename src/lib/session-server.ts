import "server-only";
import { readSessionPayload } from "@/lib/auth";

// =============================================================================
// 라우트 핸들러 전용 세션 검증 (최종 권한).
//
// 검증 계층 분리:
//   - src/middleware.ts (Edge)  : 서명 + 만료만 확인하는 1차 관문. 네트워크 호출 없음.
//   - 이 모듈 (Node, 라우트 핸들러) : 서명/만료에 더해 staff 세션은 dazzle-home 브로커의
//     staff-status 로 계정 상태(재직/정지 여부, session_version)를 재확인한다.
//     → 정지·퇴사·비밀번호 변경 시 최대 60초(캐시 TTL) 안에 세션이 무효화된다.
//
// 실패 시 닫힘(fail closed):
//   - STAFF_BROKER_SECRET 미설정 → staff 세션 전부 무효 (console.error).
//   - 브로커 네트워크 오류 / 비정상 응답 → 해당 staff 세션 무효 (console.error). 캐시하지 않음.
//   - 공용 비밀번호(admin) 세션은 브로커와 무관하므로 브로커 장애에도 유지된다.
// =============================================================================

export const BROKER_BASE_URL = "https://dazzlepeople.com";
const STAFF_STATUS_URL = `${BROKER_BASE_URL}/api/admin/staff-status`;
const STATUS_CACHE_TTL_MS = 60 * 1000;
const BROKER_TIMEOUT_MS = 5000;

export type VerifiedSession =
  | { kind: "admin" }
  | { kind: "staff"; uid: string; loginId: string };

type StaffStatus = { active: boolean; session_version: number | string | null };
const statusCache = new Map<string, { at: number; status: StaffStatus }>();

let warnedMissingBrokerSecret = false;

// 브로커 호출용 공유 시크릿. 없으면 null (호출 측에서 fail closed).
export function getBrokerSecret(): string | null {
  const s = process.env.STAFF_BROKER_SECRET;
  if (s) return s;
  if (!warnedMissingBrokerSecret) {
    warnedMissingBrokerSecret = true;
    console.error(
      "[session-server] STAFF_BROKER_SECRET is not set — staff sessions are treated as invalid and staff login is disabled."
    );
  }
  return null;
}

// 브로커 staff-status 조회 (uid 당 60초 캐시). 네트워크/응답 오류는 null (캐시 안 함).
async function fetchStaffStatus(uid: string): Promise<StaffStatus | null> {
  const cached = statusCache.get(uid);
  const now = Date.now();
  if (cached && now - cached.at < STATUS_CACHE_TTL_MS) return cached.status;

  const secret = getBrokerSecret();
  if (!secret) return null;

  try {
    const res = await fetch(STAFF_STATUS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-broker-secret": secret },
      body: JSON.stringify({ uid }),
      cache: "no-store",
      signal: AbortSignal.timeout(BROKER_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[session-server] staff-status responded ${res.status} for uid=${uid}`);
      return null;
    }
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!data || data.ok !== true || typeof data.active !== "boolean") {
      console.error("[session-server] staff-status returned an unexpected body");
      return null;
    }
    const sv = data.session_version;
    const status: StaffStatus = {
      active: data.active,
      session_version: typeof sv === "number" || typeof sv === "string" ? sv : null,
    };
    statusCache.set(uid, { at: now, status });
    return status;
  } catch (e) {
    console.error("[session-server] staff-status request failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// 세션 검증 (라우트 핸들러에서 사용). 유효하지 않으면 null.
export async function getVerifiedSession(): Promise<VerifiedSession | null> {
  const payload = await readSessionPayload();
  if (!payload) return null;
  if (payload.sub === "admin") return { kind: "admin" };

  const status = await fetchStaffStatus(payload.uid);
  if (!status) return null;
  if (status.active !== true) return null;
  if (status.session_version === null || String(status.session_version) !== String(payload.ver)) return null;
  return { kind: "staff", uid: payload.uid, loginId: payload.loginId };
}
