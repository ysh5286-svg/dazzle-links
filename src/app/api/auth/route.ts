import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  deleteSession,
  hasSessionSecret,
  recordFailedAttempt,
  isRateLimited,
  clearAttempts,
} from "@/lib/auth";
import { BROKER_BASE_URL, getBrokerSecret } from "@/lib/session-server";
import {
  THROTTLE_UNAVAILABLE_RETRY_SEC,
  checkLock,
  recordFailure,
  clearThrottle,
  ipKey,
  loginIdKey,
} from "@/lib/auth-throttle";

const VERIFY_STAFF_URL = `${BROKER_BASE_URL}/api/admin/verify-staff`;
const BROKER_TIMEOUT_MS = 8000;

const RATE_LIMITED_RESPONSE = (retryAfterSec?: number) =>
  NextResponse.json(
    { error: "너무 많은 시도입니다. 15분 후 다시 시도해주세요." },
    { status: 429, headers: retryAfterSec ? { "Retry-After": String(retryAfterSec) } : undefined }
  );

// DB throttle 판정 불가(테이블/함수 없음, DB 장애) — 비밀번호 비교 / 브로커 호출로 진행하지 않는다 (fail-closed).
const THROTTLE_UNAVAILABLE_RESPONSE = () =>
  NextResponse.json(
    { error: "로그인 시도 제한 서비스를 사용할 수 없어 잠시 로그인할 수 없습니다" },
    { status: 503, headers: { "Retry-After": String(THROTTLE_UNAVAILABLE_RETRY_SEC) } }
  );

export async function POST(request: NextRequest) {
  const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim() || "unknown";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const loginId = typeof b.loginId === "string" ? b.loginId.trim().slice(0, 64) : "";
  const password = typeof b.password === "string" ? b.password : "";
  const adminPassword = process.env.ADMIN_PASSWORD;

  // ---------------------------------------------------------------------------
  // 시도 제한 — 비밀번호 비교 / 브로커 호출 "전에" 확인. 차단 중에는 정답 여부도 알 수 없어야 한다.
  //   1차(권위): DB 기반 auth_throttle (IP 키 + staff 는 loginId 키, 원자적 RPC). 인스턴스 간 공유.
  //              DB 장애로 판정 불가(unavailable)면 503 — fail-closed.
  //   2차(보조): in-memory 카운터 (인스턴스별 추가 필터).
  // ---------------------------------------------------------------------------
  const ipLock = await checkLock(ipKey(ip));
  if (ipLock.unavailable) return THROTTLE_UNAVAILABLE_RESPONSE();
  if (ipLock.locked) return RATE_LIMITED_RESPONSE(ipLock.retryAfterSec);
  if (loginId) {
    const idLock = await checkLock(loginIdKey(loginId));
    if (idLock.unavailable) return THROTTLE_UNAVAILABLE_RESPONSE();
    if (idLock.locked) return RATE_LIMITED_RESPONSE(idLock.retryAfterSec);
  }
  if (isRateLimited(ip)) return RATE_LIMITED_RESPONSE();

  if (!hasSessionSecret()) {
    return NextResponse.json({ error: "세션 시크릿 미설정" }, { status: 500 });
  }

  // 실패 기록 헬퍼 (DB + in-memory). 차단 임계에 도달했으면 429, DB 판정 불가면 503.
  const failed = async (withId: boolean): Promise<NextResponse | null> => {
    recordFailedAttempt(ip);
    const r1 = await recordFailure(ipKey(ip));
    const r2 = withId && loginId ? await recordFailure(loginIdKey(loginId)) : null;
    if (r1.unavailable || r2?.unavailable) return THROTTLE_UNAVAILABLE_RESPONSE();
    if (r1.locked) return RATE_LIMITED_RESPONSE(r1.retryAfterSec);
    if (r2?.locked) return RATE_LIMITED_RESPONSE(r2.retryAfterSec);
    if (isRateLimited(ip)) return RATE_LIMITED_RESPONSE();
    return null;
  };
  const succeeded = async () => {
    clearAttempts(ip);
    await clearThrottle(ipKey(ip));
    if (loginId) await clearThrottle(loginIdKey(loginId));
  };

  // ---------------------------------------------------------------------------
  // 캘린더(직원) 계정 로그인 — dazzle-home 브로커 verify-staff (x-broker-secret 필수)
  //   성공 응답: { ok: true, uid, name, role, position, session_version }
  //   세션은 uid / session_version 으로 만들고, 이후 요청마다 staff-status 로 재검증된다
  //   (src/lib/session-server.ts).
  // ---------------------------------------------------------------------------
  if (loginId) {
    const brokerSecret = getBrokerSecret();
    if (!brokerSecret) {
      return NextResponse.json({ error: "인증 브로커 시크릿 미설정" }, { status: 500 });
    }
    let res: Response;
    let data: Record<string, unknown>;
    try {
      res = await fetch(VERIFY_STAFF_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-broker-secret": brokerSecret },
        body: JSON.stringify({ loginId, password }),
        cache: "no-store",
        signal: AbortSignal.timeout(BROKER_TIMEOUT_MS),
      });
      const parsed = (await res.json().catch(() => null)) as unknown;
      data = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "인증 서버 연결 실패 — 잠시 후 다시 시도해주세요" },
        { status: 502 }
      );
    }

    if (res.ok && data.ok === true) {
      const uid = data.uid;
      const ver = data.session_version;
      // 구버전 브로커(uid 미포함)는 재검증이 불가능하므로 세션을 발급하지 않는다.
      if (typeof uid !== "string" || !uid || (typeof ver !== "number" && typeof ver !== "string")) {
        console.error("[auth] verify-staff response lacks uid/session_version — broker version mismatch");
        return NextResponse.json({ error: "인증 브로커 버전 불일치" }, { status: 502 });
      }
      await succeeded();
      if (!(await createSession({ sub: "staff", uid, loginId, ver }))) {
        return NextResponse.json({ error: "세션 시크릿 미설정" }, { status: 500 });
      }
      return NextResponse.json({ success: true, name: typeof data.name === "string" ? data.name : undefined });
    }

    if (res.status === 401 || res.status === 403) {
      const limited = await failed(true);
      if (limited) return limited;
      return NextResponse.json(
        { error: typeof data.error === "string" ? data.error : "로그인 실패" },
        { status: 401 }
      );
    }
    if (res.status === 429) {
      return NextResponse.json(
        { error: typeof data.error === "string" ? data.error : "너무 많은 시도입니다." },
        { status: 429 }
      );
    }
    // 브로커 5xx / 예상 밖 응답 — 자격 증명 오류가 아니므로 실패로 집계하지 않는다.
    console.error(`[auth] verify-staff responded ${res.status}`);
    return NextResponse.json(
      { error: "인증 서버 오류 — 잠시 후 다시 시도해주세요" },
      { status: 502 }
    );
  }

  // ---------------------------------------------------------------------------
  // 공용 비밀번호 로그인
  // ---------------------------------------------------------------------------
  if (adminPassword && password && password === adminPassword) {
    await succeeded();
    if (!(await createSession({ sub: "admin" }))) {
      return NextResponse.json({ error: "세션 시크릿 미설정" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // 비밀번호 틀림 → 실패 기록 후 차단 여부 판단
  const limited = await failed(false);
  if (limited) return limited;
  return NextResponse.json(
    { error: "비밀번호가 올바르지 않습니다." },
    { status: 401 }
  );
}

export async function DELETE() {
  await deleteSession();
  return NextResponse.json({ success: true });
}
