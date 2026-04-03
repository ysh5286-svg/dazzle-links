import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// POST: 이벤트 기록 (view 또는 click)
export async function POST(request: NextRequest) {
  const { page_slug, link_id, event_type } = await request.json();
  if (!page_slug || !event_type) {
    return NextResponse.json({ error: "page_slug and event_type required" }, { status: 400 });
  }

  const referer = request.headers.get("referer") || "";

  await supabase.from("analytics").insert({
    page_slug,
    link_id: link_id || null,
    event_type,
    referer,
  });

  return NextResponse.json({ ok: true });
}

// GET: 분석 데이터 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const period = searchParams.get("period") || "7d";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  // 기간 계산
  let startDate: string;
  const now = new Date();
  if (from && to) {
    startDate = from;
  } else {
    const days = period === "all" ? 3650 : period === "7d" ? 7 : period === "1m" ? 30 : period === "3m" ? 90 : period === "6m" ? 180 : 7;
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    startDate = d.toISOString();
  }
  const endDate = to || now.toISOString();

  // 모든 이벤트 가져오기
  const { data: events } = await supabase
    .from("analytics")
    .select("*")
    .eq("page_slug", slug)
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .order("created_at");

  const rows = events || [];

  // 일별 통계
  const dailyMap: Record<string, { views: number; clicks: number }> = {};
  for (const e of rows) {
    const day = e.created_at.substring(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { views: 0, clicks: 0 };
    if (e.event_type === "view") dailyMap[day].views++;
    else if (e.event_type === "click") dailyMap[day].clicks++;
  }
  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // 총합
  const totalViews = rows.filter((e) => e.event_type === "view").length;
  const totalClicks = rows.filter((e) => e.event_type === "click").length;
  const clickRate = totalViews > 0 ? Math.round((totalClicks / totalViews) * 100) : 0;

  // 유입 채널 (referer 기반)
  const refererMap: Record<string, number> = {};
  for (const e of rows) {
    if (e.event_type !== "view" || !e.referer) continue;
    try {
      const host = new URL(e.referer).hostname.replace("www.", "");
      refererMap[host] = (refererMap[host] || 0) + 1;
    } catch { /* ignore */ }
  }
  const referers = Object.entries(refererMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // 링크별 클릭수
  const linkClickMap: Record<string, number> = {};
  for (const e of rows) {
    if (e.event_type === "click" && e.link_id) {
      linkClickMap[e.link_id] = (linkClickMap[e.link_id] || 0) + 1;
    }
  }
  const linkClicks = Object.entries(linkClickMap)
    .sort(([, a], [, b]) => b - a)
    .map(([link_id, count]) => ({ link_id, count }));

  return NextResponse.json({
    daily,
    totalViews,
    totalClicks,
    clickRate,
    referers,
    linkClicks,
  });
}
