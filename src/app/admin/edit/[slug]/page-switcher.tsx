"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PageRow } from "@/lib/supabase";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableChannel({
  page,
  isActive,
  onClick,
}: {
  page: PageRow;
  isActive: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto" as const,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive ? "bg-blue-50" : "hover:bg-gray-50"}`}>
      {/* Drag Handle */}
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-gray-300 hover:text-gray-500">
        <svg className="w-4 h-5" viewBox="0 0 16 20" fill="currentColor">
          <circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="4" r="1.5" />
          <circle cx="5" cy="10" r="1.5" /><circle cx="11" cy="10" r="1.5" />
          <circle cx="5" cy="16" r="1.5" /><circle cx="11" cy="16" r="1.5" />
        </svg>
      </div>

      {/* Channel info */}
      <button onClick={onClick} className="flex-1 flex items-center gap-3 text-left">
        {page.profile ? (
          <img src={page.profile} alt={page.title} className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
            {page.title[0]}
          </div>
        )}
        <span className={`text-sm ${isActive ? "font-bold text-blue-600" : "text-gray-700"}`}>
          {page.title}
        </span>
      </button>
    </div>
  );
}

export default function PageSwitcher({
  currentSlug,
  currentProfile,
}: {
  currentSlug: string;
  currentProfile: string;
}) {
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  useEffect(() => {
    if (open) {
      fetch("/api/pages")
        .then((r) => r.json())
        .then(setPages);
    }
  }, [open]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(pages, oldIndex, newIndex);
    setPages(reordered);
    // Update sort_order for all pages
    await Promise.all(reordered.map((page, i) =>
      fetch(`/api/pages/${page.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: i }),
      })
    ));
  }

  async function handleCreate() {
    if (!newSlug || !newTitle) return;
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: newSlug, title: newTitle }),
    });
    if (res.ok) {
      setOpen(false);
      setShowCreate(false);
      setNewSlug("");
      setNewTitle("");
      router.push(`/admin/edit/${newSlug}`);
    }
  }

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setShowCreate(false); }} />
          <div className="absolute bottom-16 left-0 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500">채널 목록</span>
            </div>
            <div className="max-h-[360px] overflow-y-auto py-1">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  {pages.map((p) => (
                    <SortableChannel
                      key={p.id}
                      page={p}
                      isActive={p.slug === currentSlug}
                      onClick={() => {
                        setOpen(false);
                        router.push(`/admin/edit/${p.slug}`);
                      }}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            {showCreate ? (
              <div className="border-t border-gray-100 p-3 flex flex-col gap-2">
                <input type="text" value={newSlug} onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                  placeholder="슬러그 (예: heredaegu)" className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900" autoFocus />
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="제목 (예: 히어대구)" className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900" />
                <button onClick={handleCreate} disabled={!newSlug || !newTitle}
                  className="py-2 bg-gray-900 text-white text-xs font-medium rounded-lg disabled:opacity-50">생성</button>
              </div>
            ) : (
              <div className="border-t border-gray-100">
                <button onClick={() => setShowCreate(true)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm text-gray-600">
                  <span className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-lg font-bold">+</span>
                  새 페이지 추가
                </button>
                <button onClick={async () => { await fetch("/api/auth", { method: "DELETE" }); router.push("/admin/login"); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm text-gray-600">
                  <span className="w-9 h-9 flex items-center justify-center text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </span>
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <button onClick={() => setOpen(!open)}
        className="w-14 h-14 rounded-full shadow-lg border-2 border-white overflow-hidden hover:scale-105 active:scale-95 transition-transform">
        {currentProfile ? (
          <img src={currentProfile} alt="현재 페이지" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center text-white text-lg font-bold">
            {currentSlug[0]?.toUpperCase() || "+"}
          </div>
        )}
      </button>
    </div>
  );
}
