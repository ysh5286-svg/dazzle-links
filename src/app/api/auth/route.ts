import { NextRequest, NextResponse } from "next/server";
import { createSession, deleteSession, checkRateLimit } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "너무 많은 시도입니다. 15분 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  const { password } = await request.json();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || password !== adminPassword) {
    return NextResponse.json(
      { error: "비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  await createSession();
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  await deleteSession();
  return NextResponse.json({ success: true });
}
