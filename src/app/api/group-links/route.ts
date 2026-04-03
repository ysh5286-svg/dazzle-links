import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET: 특정 link_id의 그룹 링크 목록
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const linkId = searchParams.get("link_id");
  if (!linkId) return NextResponse.json({ error: "link_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("group_links")
    .select("*")
    .eq("link_id", linkId)
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: 그룹 링크 추가
export async function POST(request: Request) {
  const body = await request.json();
  const { data, error } = await supabase
    .from("group_links")
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PUT: 그룹 링크 수정
export async function PUT(request: Request) {
  const { id, ...updates } = await request.json();
  const { error } = await supabase.from("group_links").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE: 그룹 링크 삭제
export async function DELETE(request: Request) {
  const { id } = await request.json();
  const { error } = await supabase.from("group_links").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
