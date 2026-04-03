"use client";

import { useEffect } from "react";

export default function AnalyticsTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (window.self !== window.top) return;

    // 유입 경로: document.referrer에서 자기 도메인 제외
    let referer = document.referrer || "";
    try {
      const refHost = new URL(referer).hostname;
      if (refHost === window.location.hostname) referer = "";
    } catch { /* invalid URL */ }

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
