import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getVerifiedSession } from "@/lib/session-server";

async function getPageId(slug: string): Promise<string | null> {
  const { data } = await supabaseServer
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .single();
  return data?.id || null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await getVerifiedSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  const pageId = await getPageId(slug);
  if (!pageId) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const body = await request.json();
  const { data, error } = await supabaseServer
    .from("links")
    .insert({ ...body, page_id: pageId })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: Request) {
  if (!(await getVerifiedSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, ...updates } = await request.json();

  const { error } = await supabaseServer.from("links").update(updates).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  if (!(await getVerifiedSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await request.json();

  const { error } = await supabaseServer.from("links").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
