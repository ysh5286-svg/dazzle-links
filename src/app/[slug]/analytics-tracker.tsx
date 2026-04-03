"use client";

import { useEffect } from "react";

export default function AnalyticsTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (window.self !== window.top) return;

    // referer 전체를 그대로 보냄 (서버에서 분류)
    const referer = document.referrer || "";

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
