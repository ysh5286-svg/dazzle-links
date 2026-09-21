import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getVerifiedSession } from "@/lib/session-server";

// GET: 모든 페이지 목록
export async function GET() {
  const { data, error } = await supabaseServer
    .from("pages")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST: 새 페이지 생성
export async function POST(request: Request) {
  if (!(await getVerifiedSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug, title } = await request.json();

  if (!slug || !title) {
    return NextResponse.json(
      { error: "slug와 title은 필수입니다." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseServer
    .from("pages")
    .insert({ slug, title, desc: "", profile: "" })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "이미 존재하는 슬러그입니다." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
