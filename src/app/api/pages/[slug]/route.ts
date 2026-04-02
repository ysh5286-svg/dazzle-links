import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET: 페이지 상세 (links, socials 포함)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const { data: page, error } = await supabase
    .from("pages")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !page) {
    return NextResponse.json({ error: "페이지를 찾을 수 없습니다." }, { status: 404 });
  }

  const [linksRes, socialsRes] = await Promise.all([
    supabase
      .from("links")
      .select("*")
      .eq("page_id", page.id)
      .order("sort_order"),
    supabase
      .from("socials")
      .select("*")
      .eq("page_id", page.id)
      .order("sort_order"),
  ]);

  return NextResponse.json({
    page,
    links: linksRes.data || [],
    socials: socialsRes.data || [],
  });
}

// PUT: 페이지 정보 수정
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const updates = await request.json();

  const { error } = await supabase
    .from("pages")
    .update(updates)
    .eq("slug", slug);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE: 페이지 삭제 (cascade로 links, socials도 삭제)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Get page id first
  const { data: page } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!page) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete related data first, then page
  await supabase.from("links").delete().eq("page_id", page.id);
  await supabase.from("socials").delete().eq("page_id", page.id);
  await supabase.from("pages").delete().eq("id", page.id);

  return NextResponse.json({ success: true });
}
