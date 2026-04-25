import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// POST: 이벤트 기록 (view 또는 click)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { page_slug, link_id, event_type } = body;
  if (!page_slug || !event_type) {
    return NextResponse.json({ error: "page_slug and event_type required" }, { status: 400 });
  }

  // 클라이언트가 보낸 referer를 그대로 사용 (빈 문자열이면 "알 수 없음"으로 유지).
  // request.headers.get("referer")로 fallback하면 현재 페이지 자신을 referer로 기록하게 되어
  // 유입 채널이 self-traffic으로 오염됨.
  const referer = typeof body.referer === "string" ? body.referer : "";
  const country = request.headers.get("x-vercel-ip-country") || "";

  await supabase.from("analytics").insert({
    page_slug,
    link_id: link_id || null,
    event_type,
    referer,
    country,
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

  // 자기 도메인 판별
  const SELF_DOMAINS = ["link.dazzlepeople.com", "dazzle-links-yoon-seonghos-projects.vercel.app", "localhost"];
  function isSelfDomain(hostname: string) {
    return SELF_DOMAINS.some((d) => hostname === d || hostname.endsWith("." + d));
  }

  // 외부 유입 채널
  const refererMap: Record<string, number> = {};
  // 내부 이동 (자기 도메인 경로)
  const internalMap: Record<string, number> = {};
  for (const e of rows) {
    if (e.event_type !== "view" || !e.referer) continue;
    try {
      const url = new URL(e.referer);
      const host = url.hostname.replace("www.", "");
      if (isSelfDomain(host)) {
        // 내부 이동: 경로까지 표시
        const path = url.pathname.replace(/^\//, "") || "home";
        internalMap[path] = (internalMap[path] || 0) + 1;
      } else {
        refererMap[host] = (refererMap[host] || 0) + 1;
      }
    } catch { /* ignore */ }
  }
  // 인앱/주요 도메인 한국어 이름 매핑
  const HOST_NAMES: Record<string, string> = {
    "kakaotalk.com": "카카오톡",
    "instagram.com": "인스타그램",
    "facebook.com": "페이스북",
    "line.me": "라인",
    "naver.com": "네이버",
    "daum.net": "다음",
    "twitter.com": "X(트위터)",
    "x.com": "X(트위터)",
    "snapchat.com": "스냅챗",
    "tiktok.com": "틱톡",
    "discord.com": "디스코드",
    "threads.net": "쓰레드",
    "youtube.com": "유튜브",
    "google.com": "구글",
  };
  const referers = Object.entries(refererMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([host, count]) => ({ name: HOST_NAMES[host] || host, count }));
  const internals = Object.entries(internalMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // 링크별 클릭수 + 일별 데이터
  const linkClickMap: Record<string, number> = {};
  const linkDailyMap: Record<string, Record<string, number>> = {};
  for (const e of rows) {
    if (e.event_type === "click" && e.link_id) {
      linkClickMap[e.link_id] = (linkClickMap[e.link_id] || 0) + 1;
      const day = e.created_at.substring(0, 10);
      if (!linkDailyMap[e.link_id]) linkDailyMap[e.link_id] = {};
      linkDailyMap[e.link_id][day] = (linkDailyMap[e.link_id][day] || 0) + 1;
    }
  }
  const linkClicks = Object.entries(linkClickMap)
    .sort(([, a], [, b]) => b - a)
    .map(([link_id, count]) => ({
      link_id,
      count,
      daily: Object.entries(linkDailyMap[link_id] || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, clicks]) => ({ date, clicks })),
    }));

  // 유입 국가
  const COUNTRY_NAMES: Record<string, string> = {
    KR: "대한민국", US: "미국", JP: "일본", CN: "중국", TW: "대만",
    HK: "홍콩", SG: "싱가포르", TH: "태국", VN: "베트남", PH: "필리핀",
    ID: "인도네시아", MY: "말레이시아", IN: "인도", AU: "호주", CA: "캐나다",
    GB: "영국", DE: "독일", FR: "프랑스", IT: "이탈리아", ES: "스페인",
  };
  const countryMap: Record<string, number> = {};
  for (const e of rows) {
    if (e.event_type !== "view" || !e.country) continue;
    countryMap[e.country] = (countryMap[e.country] || 0) + 1;
  }
  const countries = Object.entries(countryMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([code, count]) => ({ name: COUNTRY_NAMES[code] || code, count }));

  return NextResponse.json({
    daily,
    totalViews,
    totalClicks,
    clickRate,
    referers,
    internals,
    countries,
    linkClicks,
  });
}
