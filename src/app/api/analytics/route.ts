import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getVerifiedSession } from "@/lib/session-server";
import { fetchAllRows, PagedSelectError } from "@/lib/paged-select";

const EVENT_TYPES = new Set(["view", "click"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// analytics-tracker 가 links.id 가 아닌 값을 link_id 로 보내는 경우:
//  - "kakaotalk-chat" (chat-button.tsx), "sns:<platform>" (social-icons.tsx)
//  - data-link-id 조상이 없는 외부 앵커는 href 자체 (http/https URL)
const LINK_ID_SENTINEL_RE = /^(kakaotalk-chat|sns:[a-z0-9_-]{1,32})$/;
const MAX_SLUG_LEN = 64;
const MAX_LINK_ID_LEN = 500;
const MAX_REFERER_LEN = 500;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

// POST: 이벤트 기록 (view 또는 click) — 공개 엔드포인트이므로 입력을 엄격히 검증한다
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const page_slug = typeof b.page_slug === "string" ? b.page_slug : "";
  const event_type = typeof b.event_type === "string" ? b.event_type : "";
  if (!page_slug || !event_type) {
    return NextResponse.json({ error: "page_slug and event_type required" }, { status: 400 });
  }
  if (page_slug.length > MAX_SLUG_LEN || !EVENT_TYPES.has(event_type)) {
    return NextResponse.json({ error: "invalid event" }, { status: 400 });
  }

  // page_slug 는 실제 pages 행이어야 한다. "home" 은 /home (채널 목록 페이지) 전용 슬러그.
  let pageId: string | null = null;
  if (page_slug !== "home") {
    const { data: page } = await supabaseServer
      .from("pages")
      .select("id")
      .eq("slug", page_slug)
      .maybeSingle();
    if (!page) return NextResponse.json({ error: "unknown page_slug" }, { status: 400 });
    pageId = page.id;
  }

  // link_id: links.id(UUID) 면 해당 페이지 소속인지 확인, 그 외에는 허용된 sentinel 또는 http(s) URL 만
  let link_id: string | null = null;
  const rawLinkId = b.link_id;
  if (rawLinkId !== undefined && rawLinkId !== null && rawLinkId !== "") {
    if (typeof rawLinkId !== "string" || rawLinkId.length > MAX_LINK_ID_LEN) {
      return NextResponse.json({ error: "invalid link_id" }, { status: 400 });
    }
    if (UUID_RE.test(rawLinkId)) {
      if (!pageId) return NextResponse.json({ error: "invalid link_id" }, { status: 400 });
      const { data: link } = await supabaseServer
        .from("links")
        .select("id")
        .eq("id", rawLinkId)
        .eq("page_id", pageId)
        .maybeSingle();
      if (!link) return NextResponse.json({ error: "link_id does not belong to page" }, { status: 400 });
    } else if (!LINK_ID_SENTINEL_RE.test(rawLinkId) && !/^https?:\/\//i.test(rawLinkId)) {
      return NextResponse.json({ error: "invalid link_id" }, { status: 400 });
    }
    link_id = rawLinkId;
  }

  // 클라이언트가 보낸 referer를 그대로 사용 (빈 문자열이면 "알 수 없음"으로 유지).
  // request.headers.get("referer")로 fallback하면 현재 페이지 자신을 referer로 기록하게 되어
  // 유입 채널이 self-traffic으로 오염됨.
  const referer = typeof b.referer === "string" ? b.referer.slice(0, MAX_REFERER_LEN) : "";
  const country = (request.headers.get("x-vercel-ip-country") || "").slice(0, 8);

  await supabaseServer.from("analytics").insert({
    page_slug,
    link_id,
    event_type,
    referer,
    country,
  });

  return NextResponse.json({ ok: true });
}

// GET: 분석 데이터 조회 (관리자 세션 필요)
export async function GET(request: NextRequest) {
  if (!(await getVerifiedSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    // 날짜만 온 경우(YYYY-MM-DD) 시작일은 00:00, 종료일은 그날 23:59:59.999 까지 포함 (종료일 당일 이벤트 누락 방지)
    startDate = DATE_ONLY_RE.test(from) ? `${from}T00:00:00.000Z` : from;
  } else {
    const days = period === "all" ? 3650 : period === "7d" ? 7 : period === "1m" ? 30 : period === "3m" ? 90 : period === "6m" ? 180 : 7;
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    startDate = d.toISOString();
  }
  const endDate = to ? (DATE_ONLY_RE.test(to) ? `${to}T23:59:59.999Z` : to) : now.toISOString();
  if (Number.isNaN(Date.parse(startDate)) || Number.isNaN(Date.parse(endDate))) {
    return NextResponse.json({ error: "invalid date range" }, { status: 400 });
  }

  // 모든 이벤트 가져오기 — 서버 응답 상한(기본 1,000행)에 잘리지 않도록 안정 정렬(created_at, id)로 페이지 순회.
  // 중간 페이지 오류는 부분 합계 대신 500 으로 알린다.
  type EventRow = { created_at: string; event_type: string; link_id: string | null; referer: string | null; country: string | null };
  let rows: EventRow[];
  try {
    rows = await fetchAllRows<EventRow>(
      ({ from: f, to: t, order, wantCount }) => {
        let q = supabaseServer
          .from("analytics")
          .select("created_at, event_type, link_id, referer, country", wantCount ? { count: "exact" } : undefined)
          .eq("page_slug", slug)
          .gte("created_at", startDate)
          .lte("created_at", endDate);
        for (const o of order) q = q.order(o.column, { ascending: o.ascending !== false });
        return q.range(f, t);
      },
      { order: [{ column: "created_at", ascending: true }, { column: "id", ascending: true, optional: true }], pageSize: 1000 },
    );
  } catch (e) {
    const page = e instanceof PagedSelectError ? e.page : 0;
    console.error(`[analytics] page ${page} fetch failed:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "통계 조회 실패 (일부만 집계하지 않았습니다)" }, { status: 500 });
  }

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
  // 인앱/주요 도메인 한국어 이름 매핑 (정확 일치 + 부분 일치)
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
    "weixin.qq.com": "위챗",
    "youtube.com": "유튜브",
    "google.com": "구글",
  };
  // 호스트 부분 매칭 (예: pf.kakao.com, m.kakao.com → 카카오톡 채널)
  function labelHost(host: string): string {
    if (HOST_NAMES[host]) return HOST_NAMES[host];
    if (/(?:^|\.)kakao\.com$/.test(host)) return "카카오톡 채널";
    if (/(?:^|\.)kakaocorp\.com$/.test(host)) return "카카오";
    if (/(?:^|\.)naver\.com$/.test(host)) return "네이버";
    if (/(?:^|\.)daum\.net$/.test(host)) return "다음";
    if (/(?:^|\.)instagram\.com$/.test(host)) return "인스타그램";
    if (/(?:^|\.)facebook\.com$/.test(host)) return "페이스북";
    if (/(?:^|\.)tiktok\.com$/.test(host)) return "틱톡";
    if (/(?:^|\.)youtube\.com$/.test(host) || host === "youtu.be") return "유튜브";
    if (/(?:^|\.)google\.[a-z.]+$/.test(host)) return "구글";
    return host;
  }
  const referers = Object.entries(refererMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([host, count]) => ({ name: labelHost(host), count }));
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
