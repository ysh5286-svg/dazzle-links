"use client";

import { useEffect, useRef } from "react";

// 모듈 레벨: 이전 페이지 slug 기억
let prevSlug: string | null = null;

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
