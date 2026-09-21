import { NextRequest, NextResponse } from "next/server";
import { verifySessionFromRequest } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  const isAdminPage = pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");
  // 검증 계층 분리:
  //   - 여기(Edge middleware) 는 "1차 관문" — 세션 쿠키의 서명 + 만료만 확인한다.
  //     Edge 에서는 브로커/DB 를 호출하지 않으므로 계정 정지·퇴사·비밀번호 변경은 여기서 알 수 없다.
  //   - "최종 권한" 은 각 라우트 핸들러의 getVerifiedSession() (src/lib/session-server.ts) —
  //     staff 세션은 dazzle-home 브로커 staff-status 로 재검증된다 (60초 캐시).
  //   따라서 보호 API 핸들러는 반드시 getVerifiedSession() 을 직접 호출해야 한다.
  // API 보호 범위 (라우트 핸들러 자체 검증과 별개의 2중 방어)
  // - /api/pages/*        : GET 은 공개, 나머지는 세션 필요
  // - /api/group-links/*  : GET 은 공개, 나머지는 세션 필요
  // - /api/analytics/*    : POST(조회/클릭 기록) 는 공개, GET(통계 조회) 은 세션 필요
  const isProtectedApi =
    (pathname.startsWith("/api/pages") && method !== "GET") ||
    (pathname.startsWith("/api/group-links") && method !== "GET") ||
    (pathname.startsWith("/api/analytics") && method === "GET");

  if (!isAdminPage && !isProtectedApi) {
    return NextResponse.next();
  }

  const isAuthenticated = await verifySessionFromRequest(request);
  if (isAuthenticated) {
    return NextResponse.next();
  }

  if (isAdminPage) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/pages/:path*",
    "/api/group-links/:path*",
    "/api/analytics/:path*",
  ],
};
