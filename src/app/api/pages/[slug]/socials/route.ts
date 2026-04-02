import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

async function getPageId(slug: string): Promise<string | null> {
  const { data } = await supabase
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
  const { slug } = await params;
  const pageId = await getPageId(slug);
  if (!pageId) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const body = await request.json();
  const { data, error } = await supabase
    .from("socials")
    .insert({ ...body, page_id: pageId })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: Request) {
  const { id, ...updates } = await request.json();

  const { error } = await supabase
    .from("socials")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { id } = await request.json();

  const { error } = await supabase.from("socials").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
