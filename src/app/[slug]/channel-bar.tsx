"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Channel = {
  slug: string;
  title: string;
  profile: string;
};

// 모듈 레벨 캐시 - 페이지 이동해도 유지
let cachedChannels: Channel[] | null = null;

export default function ChannelBar({ currentSlug }: { currentSlug: string }) {
  const [channels, setChannels] = useState<Channel[]>(cachedChannels || []);
  const [ready, setReady] = useState(!!cachedChannels);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (cachedChannels) {
      setChannels(cachedChannels);
      setReady(true);
      return;
    }
    fetch("/api/pages")
      .then((r) => r.json())
      .then((pages: Channel[]) => {
        const filtered = pages.filter((p) => p.slug !== "home");
        cachedChannels = filtered;
        setChannels(filtered);
        setReady(true);
      })
      .catch(() => setReady(true));
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

  if (channels.length <= 1) return <div className="h-[88px]" />;

  return (
    <div
      className={`w-full max-w-[480px] mx-auto pt-4 pb-2 px-3 transition-opacity duration-300 ${
        ready ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        ref={scrollRef}
        className="flex items-center gap-4 overflow-x-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
      >
        {/* 전체 채널 보기 */}
        <button
          onClick={() => router.push("/home")}
          className="flex flex-col items-center gap-1.5 shrink-0"
        >
          <div className="w-[60px] h-[60px] rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
            </svg>
          </div>
          <span className="text-[10px] text-gray-400 font-medium w-[60px] text-center truncate">HOME</span>
        </button>

        {/* 채널 목록 */}
        {channels.map((ch) => {
          const isActive = ch.slug === currentSlug;
          return (
            <button
              key={ch.slug}
              data-slug={ch.slug}
              onClick={() => router.push(`/${ch.slug}`)}
              className="flex flex-col items-center gap-1.5 shrink-0 transition-all duration-200"
            >
              <div
                className={`w-[60px] h-[60px] rounded-full overflow-hidden border-[3px] transition-all duration-200 ${
                  isActive
                    ? "border-blue-500 scale-110 shadow-md"
                    : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                {ch.profile ? (
                  <Image
                    src={ch.profile}
                    alt={ch.title}
                    width={60}
                    height={60}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-bold">
                    {ch.title[0]}
                  </div>
                )}
              </div>
              <span
                className={`text-[10px] font-medium w-[60px] text-center truncate transition-colors duration-200 ${
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
