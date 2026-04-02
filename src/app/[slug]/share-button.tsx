"use client";

import { useState } from "react";

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;

    // Use native share on mobile if available
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // User cancelled or not supported, fall through to copy
      }
    }

    // Fallback: copy URL
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <button
        onClick={handleShare}
        className="absolute top-4 left-0 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200 flex items-center justify-center hover:bg-white active:scale-90 transition-all shadow-sm z-10"
        aria-label="공유"
      >
        <svg className="w-[18px] h-[18px] text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </button>
      {copied && (
        <div className="absolute top-16 left-0 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg z-10">
          링크 복사됨!
        </div>
      )}
    </>
  );
}
