"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Channel = {
  slug: string;
  title: string;
  profile: string;
};

export default function ChannelBar({ currentSlug }: { currentSlug: string }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/pages")
      .then((r) => r.json())
      .then((pages: Channel[]) => {
        // dazzle-list (전체 채널 페이지) 제외
        setChannels(pages.filter((p) => p.slug !== "dazzle-list"));
      })
      .catch(() => {});
  }, []);

  // 현재 채널로 자동 스크롤
  useEffect(() => {
    if (channels.length > 0 && scrollRef.current) {
      const activeEl = scrollRef.current.querySelector(`[data-slug="${currentSlug}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [channels, currentSlug]);

  if (channels.length <= 1) return null;

  return (
    <div className="w-full max-w-[480px] mx-auto pt-4 pb-2 px-3">
      <div
        ref={scrollRef}
        className="flex items-center gap-4 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* 전체 채널 보기 */}
        <button
          onClick={() => router.push("/dazzle-list")}
          className="flex flex-col items-center gap-1.5 shrink-0"
        >
          <div className="w-[60px] h-[60px] rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </div>
          <span className="text-[10px] text-gray-400 font-medium w-[60px] text-center truncate">전체보기</span>
        </button>

        {/* 채널 목록 */}
        {channels.map((ch) => {
          const isActive = ch.slug === currentSlug;
          return (
            <button
              key={ch.slug}
              data-slug={ch.slug}
              onClick={() => router.push(`/${ch.slug}`)}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <div
                className={`w-[60px] h-[60px] rounded-full overflow-hidden border-[3px] transition-all ${
                  isActive
                    ? "border-blue-500 scale-110 shadow-md"
                    : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                {ch.profile ? (
                  <img
                    src={ch.profile}
                    alt={ch.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-bold">
                    {ch.title[0]}
                  </div>
                )}
              </div>
              <span
                className={`text-[10px] font-medium w-[60px] text-center truncate ${
                  isActive ? "text-gray-900 font-bold" : "text-gray-400"
                }`}
              >
                {ch.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
