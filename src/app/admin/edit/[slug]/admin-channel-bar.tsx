"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { PageRow } from "@/lib/supabase";

let cachedPages: PageRow[] | null = null;

export default function AdminChannelBar({ currentSlug }: { currentSlug: string }) {
  const [pages, setPages] = useState<PageRow[]>(cachedPages || []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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
      <div ref={scrollRef} className="flex items-center gap-3 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
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
