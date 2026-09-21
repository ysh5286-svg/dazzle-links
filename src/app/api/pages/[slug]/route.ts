import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getVerifiedSession } from "@/lib/session-server";
import { isHexColor, isFontKey, isShapeKey, isBtnAction } from "@/lib/page-design";

// PUT 에서 수정 가능한 컬럼 화이트리스트 + 값 검증 (알 수 없는 키는 무시)
const SLUG_RE = /^[a-z0-9_.-]{1,64}$/;
const TEXT_FIELDS: Record<string, number> = { title: 200, desc: 2000, profile: 2000, category: 100 };
const COLOR_FIELDS = ["bg_color", "hover_color", "btn_color"] as const;
type PageUpdates = Record<string, string | number | boolean | null>;

function pickPageUpdates(body: unknown): { updates?: PageUpdates; error?: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "invalid body" };
  const b = body as Record<string, unknown>;
  const updates: PageUpdates = {};

  for (const [key, max] of Object.entries(TEXT_FIELDS)) {
    if (!(key in b)) continue;
    const v = b[key];
    if (typeof v !== "string" || v.length > max) return { error: `${key} invalid` };
    updates[key] = v;
  }
  for (const key of COLOR_FIELDS) {
    if (!(key in b)) continue;
    if (!isHexColor(b[key])) return { error: `${key} invalid` };
    updates[key] = b[key] as string;
  }
  if ("btn_shape" in b) {
    if (!isShapeKey(b.btn_shape)) return { error: "btn_shape invalid" };
    updates.btn_shape = b.btn_shape;
  }
  if ("btn_action" in b) {
    if (!isBtnAction(b.btn_action)) return { error: "btn_action invalid" };
    updates.btn_action = b.btn_action;
  }
  if ("font" in b) {
    if (!isFontKey(b.font)) return { error: "font invalid" };
    updates.font = b.font;
  }
  if ("sort_order" in b) {
    const v = b.sort_order;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 100000) return { error: "sort_order invalid" };
    updates.sort_order = v;
  }
  if ("badge_color" in b) {
    const v = b.badge_color;
    if (v !== null && !isHexColor(v)) return { error: "badge_color invalid" };
    updates.badge_color = v as string | null;
  }
  if ("profile_ring" in b) {
    if (typeof b.profile_ring !== "boolean") return { error: "profile_ring invalid" };
    updates.profile_ring = b.profile_ring;
  }
  if ("slug" in b) {
    const v = b.slug;
    if (typeof v !== "string" || !SLUG_RE.test(v)) return { error: "slug invalid" };
    updates.slug = v;
  }
  if (Object.keys(updates).length === 0) return { error: "no updatable fields" };
  return { updates };
}

// GET: 페이지 상세 (links, socials 포함)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const { data: page, error } = await supabaseServer
    .from("pages")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !page) {
    return NextResponse.json({ error: "페이지를 찾을 수 없습니다." }, { status: 404 });
  }

  const [linksRes, socialsRes] = await Promise.all([
    supabaseServer
      .from("links")
      .select("*")
      .eq("page_id", page.id)
      .order("sort_order"),
    supabaseServer
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
  if (!(await getVerifiedSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { updates, error: validationError } = pickPageUpdates(body);
  if (!updates) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from("pages")
    .update(updates)
    .eq("slug", slug);

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "이미 존재하는 슬러그입니다." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE: 페이지 삭제 (cascade로 links, socials도 삭제)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await getVerifiedSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;

  // Get page id first
  const { data: page } = await supabaseServer
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!page) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete related data first, then page
  await supabaseServer.from("links").delete().eq("page_id", page.id);
  await supabaseServer.from("socials").delete().eq("page_id", page.id);
  await supabaseServer.from("pages").delete().eq("id", page.id);

  return NextResponse.json({ success: true });
}
