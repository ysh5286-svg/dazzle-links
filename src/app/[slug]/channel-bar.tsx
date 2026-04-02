"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

function useDragScroll(ref: React.RefObject<HTMLDivElement | null>) {
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    isDown.current = true;
    startX.current = e.pageX - ref.current.offsetLeft;
    scrollLeft.current = ref.current.scrollLeft;
    ref.current.style.cursor = "grabbing";
  }, [ref]);

  const onMouseLeave = useCallback(() => {
    isDown.current = false;
    if (ref.current) ref.current.style.cursor = "grab";
  }, [ref]);

  const onMouseUp = useCallback(() => {
    isDown.current = false;
    if (ref.current) ref.current.style.cursor = "grab";
  }, [ref]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDown.current || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    ref.current.scrollLeft = scrollLeft.current - (x - startX.current);
  }, [ref]);

  return { onMouseDown, onMouseLeave, onMouseUp, onMouseMove };
}

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
        if (!Array.isArray(pages)) {
          setReady(true);
          return;
        }
        cachedChannels = pages;
        setChannels(pages);
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

  const dragHandlers = useDragScroll(scrollRef);

  if (channels.length <= 1) return <div className="h-[88px]" />;

  function scrollBy(dir: number) {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 200, behavior: "smooth" });
    }
  }

  return (
    <div
      className={`w-full max-w-[480px] mx-auto pt-4 pb-2 px-3 transition-opacity duration-300 relative overflow-hidden ${
        ready ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Left Arrow */}
      <button onClick={() => scrollBy(-1)}
        className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/90 border border-gray-200 rounded-full items-center justify-center shadow-sm hover:bg-gray-50">
        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      {/* Right Arrow */}
      <button onClick={() => scrollBy(1)}
        className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/90 border border-gray-200 rounded-full items-center justify-center shadow-sm hover:bg-gray-50">
        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div
        ref={scrollRef}
        className="flex items-center gap-4 overflow-x-auto cursor-grab"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
        {...dragHandlers}
      >
        {/* 전체 채널 보기 */}
        <button
          onClick={() => router.push("/home")}
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
