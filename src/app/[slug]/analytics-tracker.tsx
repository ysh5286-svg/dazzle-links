"use client";

import { useEffect } from "react";

export default function AnalyticsTracker({ slug }: { slug: string }) {
  useEffect(() => {
    // 페이지 조회 기록
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page_slug: slug,
        event_type: "view",
      }),
    }).catch(() => {});

    // 링크 클릭 추적 (이벤트 위임)
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || !anchor.href || anchor.href.startsWith(window.location.origin)) return;

      // 외부 링크 클릭만 추적
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
