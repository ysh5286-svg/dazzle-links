import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  deleteSession,
  recordFailedAttempt,
  isRateLimited,
  clearAttempts,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const { password } = await request.json();
  const adminPassword = process.env.ADMIN_PASSWORD;

  // 비밀번호가 맞으면 레이트리밋과 무관하게 항상 로그인 허용.
  // (브루트포스 공격자는 올바른 비밀번호를 모르므로, 정답을 막을 이유가 없다.)
  if (adminPassword && password === adminPassword) {
    clearAttempts(ip); // 누적된 실패 기록 초기화
    await createSession();
    return NextResponse.json({ success: true });
  }

  // 비밀번호 틀림 → 실패 기록 후 차단 여부 판단
  recordFailedAttempt(ip);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "너무 많은 시도입니다. 15분 후 다시 시도해주세요." },
      { status: 429 }
    );
  }
  return NextResponse.json(
    { error: "비밀번호가 올바르지 않습니다." },
    { status: 401 }
  );
}

export async function DELETE() {
  await deleteSession();
  return NextResponse.json({ success: true });
}
