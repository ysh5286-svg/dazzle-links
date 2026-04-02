"use client";

import { useState } from "react";

function isMobile() {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || ("ontouchstart" in window && window.innerWidth < 1024);
}

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;
    const title = document.title;

    if (isMobile() && navigator.share) {
      // 모바일: 네이티브 공유 시트 (카카오톡, 메시지 등)
      try {
        await navigator.share({ title, text: title, url });
      } catch {
        // 사용자 취소
      }
      return;
    }

    // 데스크탑: 바로 클립보드 복사
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      <button
        onClick={handleShare}
        className="absolute top-4 left-6 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200 flex items-center justify-center hover:bg-gray-200 active:scale-90 transition-all shadow-sm z-10"
        aria-label="공유"
      >
        <svg className="w-[18px] h-[18px] text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </button>
      {copied && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-full shadow-lg z-50">
          링크가 복사되었습니다
        </div>
      )}
    </>
  );
}
