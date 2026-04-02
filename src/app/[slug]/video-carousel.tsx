"use client";

import { useRef, useState, useCallback } from "react";
import InlineVideo from "./inline-video";

function getYoutubeId(url: string) {
  const m = url.match(/(?:shorts\/|watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function VideoCarousel({ urls }: { urls: string[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  // Pointer drag for desktop + touch
  const dragging = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);
  const moved = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!scrollRef.current) return;
    dragging.current = true;
    moved.current = false;
    startX.current = e.clientX;
    scrollStart.current = scrollRef.current.scrollLeft;
    scrollRef.current.style.scrollSnapType = "none";
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !scrollRef.current) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 5) moved.current = true;
    scrollRef.current.scrollLeft = scrollStart.current - dx;
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!scrollRef.current) return;
    dragging.current = false;
    scrollRef.current.style.scrollSnapType = "x mandatory";
    // Snap to nearest item
    const itemW = scrollRef.current.firstElementChild?.getBoundingClientRect().width || 200;
    const gap = 12;
    const idx = Math.round(scrollRef.current.scrollLeft / (itemW + gap));
    const clamped = Math.max(0, Math.min(urls.length - 1, idx));
    scrollRef.current.scrollTo({ left: clamped * (itemW + gap), behavior: "smooth" });
    setCurrent(clamped);
  }, [urls.length]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || dragging.current) return;
    const itemW = scrollRef.current.firstElementChild?.getBoundingClientRect().width || 200;
    const gap = 12;
    const idx = Math.round(scrollRef.current.scrollLeft / (itemW + gap));
    setCurrent(Math.max(0, Math.min(urls.length - 1, idx)));
  }, [urls.length]);

  return (
    <div className="w-full">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto touch-pan-x select-none"
        style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onScroll={handleScroll}
      >
        {urls.map((url, i) => {
          const vid = getYoutubeId(url);
          if (!vid) return null;
          return (
            <div key={i} className="w-[75%] shrink-0" style={{ scrollSnapAlign: "center" }}>
              <InlineVideo vid={vid} />
            </div>
          );
        })}
      </div>
      {/* Dots indicator */}
      {urls.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {urls.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? "bg-gray-800 w-4" : "bg-gray-300"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
