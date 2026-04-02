"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PageRow } from "@/lib/supabase";

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

  useEffect(() => {
    if (open) {
      fetch("/api/pages")
        .then((r) => r.json())
        .then(setPages);
    }
  }, [open]);

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
      {/* Popup */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setShowCreate(false); }} />
          <div className="absolute bottom-16 left-0 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
            <div className="max-h-[360px] overflow-y-auto py-2">
              {pages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setOpen(false);
                    router.push(`/admin/edit/${p.slug}`);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${
                    p.slug === currentSlug ? "bg-blue-50" : ""
                  }`}
                >
                  {p.profile ? (
                    <img src={p.profile} alt={p.title} className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                      {p.title[0]}
                    </div>
                  )}
                  <span className={`text-sm ${p.slug === currentSlug ? "font-bold text-blue-600" : "text-gray-700"}`}>
                    {p.slug}
                  </span>
                </button>
              ))}
            </div>

            {/* Create new page */}
            {showCreate ? (
              <div className="border-t border-gray-100 p-3 flex flex-col gap-2">
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="슬러그 (예: heredaegu)"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                  autoFocus
                />
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="제목 (예: 히어대구)"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  onClick={handleCreate}
                  disabled={!newSlug || !newTitle}
                  className="py-2 bg-gray-900 text-white text-xs font-medium rounded-lg disabled:opacity-50"
                >
                  생성
                </button>
              </div>
            ) : (
              <div className="border-t border-gray-100">
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm text-gray-600"
                >
                  <span className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-lg font-bold">+</span>
                  새 페이지 추가
                </button>
                <button
                  onClick={async () => {
                    await fetch("/api/auth", { method: "DELETE" });
                    router.push("/admin/login");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm text-gray-600"
                >
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

      {/* Profile Button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-14 h-14 rounded-full shadow-lg border-2 border-white overflow-hidden hover:scale-105 active:scale-95 transition-transform"
      >
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
