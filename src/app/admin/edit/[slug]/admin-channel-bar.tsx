"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { PageRow } from "@/lib/supabase";

let cachedPages: PageRow[] | null = null;

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
  const onMouseLeave = useCallback(() => { isDown.current = false; if (ref.current) ref.current.style.cursor = "grab"; }, [ref]);
  const onMouseUp = useCallback(() => { isDown.current = false; if (ref.current) ref.current.style.cursor = "grab"; }, [ref]);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDown.current || !ref.current) return;
    e.preventDefault();
    ref.current.scrollLeft = scrollLeft.current - (e.pageX - ref.current.offsetLeft - startX.current);
  }, [ref]);

  return { onMouseDown, onMouseLeave, onMouseUp, onMouseMove };
}

export default function AdminChannelBar({ currentSlug }: { currentSlug: string }) {
  const [pages, setPages] = useState<PageRow[]>(cachedPages || []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const dragHandlers = useDragScroll(scrollRef);

  useEffect(() => {
    if (cachedPages) { setPages(cachedPages); return; }
    fetch("/api/pages").then((r) => r.json()).then((data: PageRow[]) => {
      cachedPages = data;
      setPages(data);
    });
  }, []);

  useEffect(() => {
    if (pages.length > 0 && scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-slug="${currentSlug}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [pages, currentSlug]);

  if (pages.length <= 1) return null;

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 shrink-0">
      <div ref={scrollRef} className="flex items-center gap-3 overflow-x-auto cursor-grab" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }} {...dragHandlers}>
        {pages.map((p) => {
          const isActive = p.slug === currentSlug;
          return (
            <button
              key={p.id}
              data-slug={p.slug}
              onClick={() => router.push(`/admin/edit/${p.slug}`)}
              className="flex flex-col items-center gap-1 shrink-0"
            >
              <div className={`w-11 h-11 rounded-full overflow-hidden border-[2.5px] transition-all duration-200 ${isActive ? "border-blue-500 scale-110" : "border-transparent opacity-50 hover:opacity-100"}`}>
                {p.profile ? (
                  <Image src={p.profile} alt={p.title} width={44} height={44} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-[10px] font-bold">{p.title[0]}</div>
                )}
              </div>
              <span className={`text-[9px] w-12 text-center truncate ${isActive ? "text-gray-900 font-bold" : "text-gray-400"}`}>{p.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
