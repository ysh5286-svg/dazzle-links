import { NextRequest, NextResponse } from "next/server";
import { verifySessionFromRequest } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes (except /admin/login)
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const isAuthenticated = verifySessionFromRequest(request);
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // Protect API routes (except /api/auth) — only for write operations
  if (pathname.startsWith("/api/pages") && request.method !== "GET") {
    const isAuthenticated = verifySessionFromRequest(request);
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/pages/:path*"],
};
