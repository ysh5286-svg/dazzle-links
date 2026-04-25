"use client";

import { useEffect, useRef } from "react";

// 모듈 레벨: 이전 페이지 slug 기억
let prevSlug: string | null = null;

// 인앱 브라우저(카톡/인스타/페북 등) 유입은 document.referrer가 빈 값으로 오므로
// User-Agent 로 식별해서 의사-referer 를 채워 분석 통계에 잡히게 한다.
function detectInAppReferer(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent || "";
  if (/KAKAOTALK/i.test(ua)) return "https://kakaotalk.com/";
  if (/Instagram/i.test(ua)) return "https://instagram.com/";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "https://facebook.com/";
  if (/Line\//i.test(ua)) return "https://line.me/";
  if (/NAVER\(inapp|NaverApp/i.test(ua)) return "https://naver.com/";
  if (/Daum(?!on)/i.test(ua)) return "https://daum.net/";
  if (/Twitter/i.test(ua)) return "https://twitter.com/";
  if (/Snapchat/i.test(ua)) return "https://snapchat.com/";
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return "https://tiktok.com/";
  if (/DiscordBot|Discord\//i.test(ua)) return "https://discord.com/";
  if (/Threads/i.test(ua)) return "https://threads.net/";
  return "";
}

export default function AnalyticsTracker({ slug }: { slug: string }) {
  const isFirst = useRef(true);

  useEffect(() => {
    if (window.self !== window.top) return;

    let referer = "";

    if (prevSlug && prevSlug !== slug) {
      // 내부 이동: 이전 채널에서 넘어옴
      referer = `${window.location.origin}/${prevSlug}`;
    } else if (isFirst.current) {
      // 첫 접속: document.referrer 사용 (자기 자신 제외)
      const ref = document.referrer || "";
      try {
        const refUrl = new URL(ref);
        const refPath = refUrl.pathname.replace(/^\//, "");
        if (refPath === slug) {
          referer = ""; // 자기 자신이면 무시 (새로고침)
        } else {
          referer = ref;
        }
      } catch {
        referer = ref;
      }

      // URL 쿼리 파라미터로 명시적 유입원 태깅 지원 (referrer 정책이 벗겨진 경우 fallback)
      // 예: link.dazzlepeople.com/mychannel?from=p.dazzlepeople.com
      try {
        const fromParam = new URLSearchParams(window.location.search).get("from");
        if (fromParam && !referer) {
          referer = /^https?:\/\//.test(fromParam) ? fromParam : `https://${fromParam}`;
        }
      } catch { /* ignore */ }

      // 그래도 referer 비어있으면 User-Agent 로 인앱 브라우저 식별 시도
      if (!referer) {
        const inApp = detectInAppReferer();
        if (inApp) referer = inApp;
      }
    }

    isFirst.current = false;
    prevSlug = slug;

    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page_slug: slug,
        event_type: "view",
        referer,
      }),
    }).catch(() => {});

    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || !anchor.href || anchor.href.startsWith(window.location.origin)) return;

      const linkId = anchor.closest("[data-link-id]")?.getAttribute("data-link-id") || anchor.href;
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_slug: slug,
          link_id: linkId,
          event_type: "click",
        }),
      }).catch(() => {});
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [slug]);

  return null;
}
