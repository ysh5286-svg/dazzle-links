"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import type { PageRow } from "@/lib/supabase";

let cachedPages: PageRow[] | null = null;

export default function AdminChannelBar({ currentSlug }: { currentSlug: string }) {
  const [pages, setPages] = useState<PageRow[]>(cachedPages || []);
  const [showAddModal, setShowAddModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isHomeView = pathname === "/admin/home";

  // Drag-to-reorder state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef({ x: 0, y: 0 });

  const fetchPages = useCallback(() => {
    fetch("/api/pages").then((r) => r.json()).then((data: PageRow[]) => {
      if (!Array.isArray(data)) return;
      cachedPages = data;
      setPages(data);
    });
  }, []);

  useEffect(() => {
    if (cachedPages) { setPages(cachedPages); return; }
    fetchPages();
  }, [fetchPages]);

  useEffect(() => {
    if (pages.length > 0 && scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-slug="${currentSlug}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [pages, currentSlug]);

  // Drag-and-drop reorder (pointer events for both mouse & touch)
  function handleDragStart(index: number, id: string) {
    dragItem.current = index;
    setDraggingId(id);
  }

  function handleDragEnter(index: number) {
    if (dragItem.current === null) return;
    dragOverItem.current = index;
    const reordered = [...pages];
    const [removed] = reordered.splice(dragItem.current, 1);
    reordered.splice(index, 0, removed);
    dragItem.current = index;
    setPages(reordered);
  }

  async function handleDragEnd() {
    if (dragItem.current === null) return;
    dragItem.current = null;
    dragOverItem.current = null;
    setDraggingId(null);
    // Save new order
    await Promise.all(pages.map((p, i) =>
      fetch(`/api/pages/${p.slug}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sort_order: i }) })
    ));
    cachedPages = pages;
  }

  // Long press to start drag on touch
  function handleTouchStart(e: React.TouchEvent, index: number, id: string) {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    longPressTimer.current = setTimeout(() => {
      handleDragStart(index, id);
    }, 400);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (longPressTimer.current) {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
    if (draggingId && scrollRef.current) {
      const touch = e.touches[0];
      const items = scrollRef.current.querySelectorAll("[data-channel-index]");
      for (const item of items) {
        const rect = item.getBoundingClientRect();
        if (touch.clientX >= rect.left && touch.clientX <= rect.right) {
          const idx = parseInt(item.getAttribute("data-channel-index") || "");
          if (!isNaN(idx)) handleDragEnter(idx);
          break;
        }
      }
    }
  }

  function handleTouchEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (draggingId) handleDragEnd();
  }

  // Add page
  async function addPage(slug: string, title: string) {
    await fetch("/api/pages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, title }),
    });
    cachedPages = null;
    fetchPages();
    setShowAddModal(false);
    router.push(`/admin/edit/${slug}`);
  }

  function scrollBy(dir: number) {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: dir * 200, behavior: "smooth" });
  }

  return (
    <>
      {showAddModal && <AddPageModal onClose={() => setShowAddModal(false)} onAdd={addPage} />}
      <div className="bg-white border-b border-gray-200 px-4 py-2 shrink-0 relative overflow-hidden">
        <button onClick={() => scrollBy(-1)}
          className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/90 border border-gray-200 rounded-full items-center justify-center shadow-sm hover:bg-gray-50">
          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <button onClick={() => scrollBy(1)}
          className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/90 border border-gray-200 rounded-full items-center justify-center shadow-sm hover:bg-gray-50">
          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
        <div ref={scrollRef} className="flex items-center gap-3 overflow-x-auto mx-6"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>

          {/* + 페이지 추가 버튼 */}
          <button onClick={() => setShowAddModal(true)} className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-11 h-11 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-gray-500 hover:bg-gray-50 transition-all">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-[9px] w-12 text-center text-gray-400">추가</span>
          </button>

          {/* 전체 채널 (홈) 분석 */}
          <button onClick={() => router.push("/admin/home")} className="flex flex-col items-center gap-1 shrink-0">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 border-[2.5px] ${isHomeView ? "border-blue-500 scale-110 bg-gradient-to-br from-pink-500 to-orange-400" : "border-transparent bg-gradient-to-br from-pink-500 to-orange-400 opacity-50 hover:opacity-100"}`}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h4v4H4zM4 14h4v4H4zM14 6h4v4h-4zM14 14h4v4h-4z" />
              </svg>
            </div>
            <span className={`text-[9px] w-12 text-center truncate block ${isHomeView ? "text-gray-900 font-bold" : "text-gray-400"}`}>전체 채널</span>
          </button>

          {/* 채널 목록 */}
          {pages.map((p, index) => {
            const isActive = p.slug === currentSlug;
            const isDragging = draggingId === p.id;
            return (
              <div
                key={p.id}
                data-slug={p.slug}
                data-channel-index={index}
                draggable
                onDragStart={() => handleDragStart(index, p.id)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                onTouchStart={(e) => handleTouchStart(e, index, p.id)}
                className={`flex flex-col items-center gap-1 shrink-0 transition-all duration-150 ${isDragging ? "opacity-40 scale-90" : ""}`}
              >
                <button onClick={() => !draggingId && router.push(`/admin/edit/${p.slug}`)}>
                  <div className={`w-11 h-11 rounded-full overflow-hidden border-[2.5px] transition-all duration-200 ${isActive ? "border-blue-500 scale-110" : "border-transparent opacity-50 hover:opacity-100"}`}>
                    {p.profile ? (
                      <Image src={p.profile} alt={p.title} width={44} height={44} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-[10px] font-bold">{p.title[0]}</div>
                    )}
                  </div>
                  <span className={`text-[9px] w-12 text-center truncate block ${isActive ? "text-gray-900 font-bold" : "text-gray-400"}`}>{p.title}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// --- Add Page Modal ---

function AddPageModal({ onClose, onAdd }: { onClose: () => void; onAdd: (slug: string, title: string) => void }) {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  function handleSubmit() {
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    if (!cleanSlug || !title) {
      setError("슬러그와 제목을 모두 입력해주세요.");
      return;
    }
    onAdd(cleanSlug, title);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-base font-bold text-gray-900 text-center mb-5">페이지 추가</h3>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">제목</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="채널 이름"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">슬러그 (URL)</label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400 shrink-0">link.dazzlepeople.com/</span>
                <input type="text" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))} placeholder="my-channel"
                  className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button onClick={handleSubmit} className="w-full py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 mt-2">
              추가
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
