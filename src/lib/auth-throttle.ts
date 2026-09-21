import "server-only";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * 로그인 무차별 대입 방어 — DB(auth_throttle) 기반 시도 횟수 제한.
 * (dazzle-schedule 의 src/lib/authThrottle.ts 를 이 프로젝트용으로 이식)
 *
 * DB 전제: migrations/2026-09-21-auth-throttle.sql
 *   - auth_throttle 테이블
 *   - auth_throttle_fail(p_key, p_threshold, p_window_sec, p_lock_sec) RPC (service_role 전용)
 *
 * 왜 DB 인가: Vercel 서버리스는 인스턴스가 여러 개 + 콜드스타트마다 메모리 초기화라
 *   in-memory 카운터(src/lib/auth.ts)는 잠금이 새거나 리셋됨(우회 가능). 공유 DB 에 둬야 확실.
 *   in-memory 카운터는 2차 필터로만 남긴다.
 *
 * 왜 RPC 인가: select → 계산 → upsert 는 동시 실패 요청이 서로의 증가분을 덮어쓴다.
 *   auth_throttle_fail 은 단일 INSERT ... ON CONFLICT DO UPDATE 라 행 잠금으로 직렬화되어
 *   카운터가 정확히 1씩 증가한다 (원자적).
 *
 * 정책:
 *  - windowSec 안에 threshold 회 연속 실패 → lockSec 동안 잠금.
 *  - 마지막 실패가 windowSec 보다 오래됐으면 카운터 리셋(오타 누적 방지).
 *  - 성공 시 clearThrottle 로 즉시 해제.
 *
 * key 규약: `links-login:ip:<ip>` / `links-login:id:<login_id_lowercase>`
 *
 * 실패 시 닫힘 (fail-closed):
 *   checkLock / recordFailure 가 DB 오류(테이블·함수 없음, anon 키 폴백으로 권한 없음 등)를 만나면
 *   `unavailable: true` 와 함께 locked=true 를 돌려주고, /api/auth 는 비밀번호 비교 / 브로커 호출로
 *   진행하지 않고 503 을 반환한다. 프로세스당 1회 console.error.
 */

export type ThrottleConfig = { threshold: number; windowSec: number; lockSec: number };

export const LOGIN_THROTTLE: ThrottleConfig = { threshold: 10, windowSec: 15 * 60, lockSec: 15 * 60 };

/** throttle 저장소 장애 시 라우트가 503 으로 응답하기 전 클라이언트에 안내할 재시도 간격 */
export const THROTTLE_UNAVAILABLE_RETRY_SEC = 60;

export type LockState = {
  locked: boolean;
  retryAfterSec: number;
  /** DB 오류로 판정 불가 — 라우트는 503 으로 응답해야 한다 (locked 는 항상 true) */
  unavailable?: true;
};
export type FailureResult = LockState & { remaining: number };

type FailRow = { fail_count: number; locked_until: string | null };

const UNAVAILABLE: LockState = { locked: true, retryAfterSec: THROTTLE_UNAVAILABLE_RETRY_SEC, unavailable: true };

let warnedUnavailable = false;
function warnUnavailable(op: string, err: unknown) {
  if (warnedUnavailable) return;
  warnedUnavailable = true;
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err);
  console.error(
    `[auth-throttle] ${op} failed — DB throttle unavailable, logins are refused with 503 (fail-closed). ` +
      "Apply migrations/2026-09-21-auth-throttle.sql (table + auth_throttle_fail RPC) and check SUPABASE_SERVICE_ROLE_KEY. " +
      msg
  );
}

/** 현재 잠금 여부 확인 (단순 select). 조회 실패 시 unavailable(=locked) 반환 — fail-closed. */
export async function checkLock(key: string): Promise<LockState> {
  try {
    const { data, error } = await supabaseServer
      .from("auth_throttle")
      .select("locked_until")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    const lockedUntil = (data as { locked_until: string | null } | null)?.locked_until;
    if (!lockedUntil) return { locked: false, retryAfterSec: 0 };
    const remainMs = new Date(lockedUntil).getTime() - Date.now();
    if (remainMs > 0) return { locked: true, retryAfterSec: Math.ceil(remainMs / 1000) };
    return { locked: false, retryAfterSec: 0 };
  } catch (e) {
    warnUnavailable("checkLock", e);
    return UNAVAILABLE;
  }
}

/**
 * 실패 1회 기록 — auth_throttle_fail RPC 단일 원자 UPSERT.
 * 임계 도달 시 잠금 설정하고 locked=true 반환. RPC 실패 시 unavailable(=locked) — fail-closed.
 */
export async function recordFailure(
  key: string,
  cfg: ThrottleConfig = LOGIN_THROTTLE
): Promise<FailureResult> {
  try {
    const { data, error } = await supabaseServer.rpc("auth_throttle_fail", {
      p_key: key,
      p_threshold: cfg.threshold,
      p_window_sec: cfg.windowSec,
      p_lock_sec: cfg.lockSec,
    });
    if (error) throw error;
    // RETURNS TABLE → 배열 (1행). 행이 없으면 비정상 → 판정 불가로 취급.
    const row = (Array.isArray(data) ? data[0] : data) as FailRow | null | undefined;
    if (!row || typeof row.fail_count !== "number") {
      throw new Error("auth_throttle_fail returned no row");
    }
    const remaining = Math.max(0, cfg.threshold - row.fail_count);
    if (row.locked_until) {
      const remainMs = new Date(row.locked_until).getTime() - Date.now();
      if (remainMs > 0) return { locked: true, retryAfterSec: Math.ceil(remainMs / 1000), remaining: 0 };
    }
    return { locked: false, retryAfterSec: 0, remaining };
  } catch (e) {
    warnUnavailable("recordFailure", e);
    return { ...UNAVAILABLE, remaining: 0 };
  }
}

/** 잠금/카운터 해제 — 로그인 성공 시 호출 (단순 delete, best-effort). */
export async function clearThrottle(key: string): Promise<void> {
  try {
    const { error } = await supabaseServer.from("auth_throttle").delete().eq("key", key);
    if (error) throw error;
  } catch (e) {
    warnUnavailable("clearThrottle", e);
  }
}

export const ipKey = (ip: string) => `links-login:ip:${ip}`;
export const loginIdKey = (loginId: string) => `links-login:id:${loginId.toLowerCase()}`;
