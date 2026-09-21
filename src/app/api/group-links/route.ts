import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getVerifiedSession } from "@/lib/session-server";

type GroupLinkFields = Record<string, string | number | boolean | null>;

const MAX_LABEL = 200;
const MAX_URL = 2000;
const MAX_PRICE = 100;

// 쓰기 가능한 필드만 골라내고 타입/길이를 검증한다. 알 수 없는 키는 무시.
function pickGroupLinkFields(body: unknown): { fields?: GroupLinkFields; error?: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "invalid body" };
  const b = body as Record<string, unknown>;
  const fields: GroupLinkFields = {};

  const optionalText = (key: string, max: number, nullable: boolean) => {
    if (!(key in b)) return null;
    const v = b[key];
    if (v === null && nullable) { fields[key] = null; return null; }
    if (typeof v !== "string" || v.length > max) return `${key} invalid`;
    fields[key] = v;
    return null;
  };

  const err =
    optionalText("label", MAX_LABEL, false) ||
    optionalText("url", MAX_URL, false) ||
    optionalText("image", MAX_URL, true) ||
    optionalText("price", MAX_PRICE, true) ||
    optionalText("original_price", MAX_PRICE, true);
  if (err) return { error: err };

  if ("enabled" in b) {
    if (typeof b.enabled !== "boolean") return { error: "enabled invalid" };
    fields.enabled = b.enabled;
  }
  if ("sort_order" in b) {
    const v = b.sort_order;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 100000) return { error: "sort_order invalid" };
    fields.sort_order = v;
  }
  return { fields };
}

function readId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const id = (body as Record<string, unknown>).id;
  return typeof id === "string" && id.length > 0 && id.length <= 64 ? id : null;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// GET: 특정 link_id의 그룹 링크 목록 (공개 — 렌더링용)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const linkId = searchParams.get("link_id");
  if (!linkId) return NextResponse.json({ error: "link_id required" }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("group_links")
    .select("*")
    .eq("link_id", linkId)
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: 그룹 링크 추가
export async function POST(request: Request) {
  if (!(await getVerifiedSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson(request);
  const { fields, error: fieldError } = pickGroupLinkFields(body);
  if (!fields) return NextResponse.json({ error: fieldError }, { status: 400 });

  const linkId = (body as Record<string, unknown>).link_id;
  if (typeof linkId !== "string" || !linkId || linkId.length > 64) {
    return NextResponse.json({ error: "link_id required" }, { status: 400 });
  }
  // link_id 가 실제 links 행을 가리키는지 확인
  const { data: parent, error: parentError } = await supabaseServer
    .from("links")
    .select("id")
    .eq("id", linkId)
    .maybeSingle();
  if (parentError || !parent) {
    return NextResponse.json({ error: "link_id not found" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("group_links")
    .insert({ ...fields, link_id: linkId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PUT: 그룹 링크 수정
export async function PUT(request: Request) {
  if (!(await getVerifiedSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson(request);
  const id = readId(body);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { fields, error: fieldError } = pickGroupLinkFields(body);
  if (!fields) return NextResponse.json({ error: fieldError }, { status: 400 });
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "no updatable fields" }, { status: 400 });
  }

  const { data: existing, error: lookupError } = await supabaseServer
    .from("group_links")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (lookupError || !existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabaseServer.from("group_links").update(fields).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE: 그룹 링크 삭제
export async function DELETE(request: Request) {
  if (!(await getVerifiedSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = readId(await readJson(request));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: existing, error: lookupError } = await supabaseServer
    .from("group_links")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (lookupError || !existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabaseServer.from("group_links").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
