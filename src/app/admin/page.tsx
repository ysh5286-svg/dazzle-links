"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PageRow } from "@/lib/supabase";

export default function AdminDashboard() {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetchPages();
  }, []);

  async function fetchPages() {
    const res = await fetch("/api/pages");
    if (res.ok) {
      const data = await res.json();
      setPages(data);
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: newSlug, title: newTitle }),
    });
    if (res.ok) {
      setNewSlug("");
      setNewTitle("");
      setShowCreate(false);
      fetchPages();
    }
  }

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/admin/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Dazzle Links 관리</h1>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          로그아웃
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Page List */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-gray-800">
            페이지 목록 ({pages.length})
          </h2>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all"
          >
            + 새 페이지
          </button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 flex flex-col gap-3"
          >
            <input
              type="text"
              value={newSlug}
              onChange={(e) =>
                setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              placeholder="URL 슬러그 (예: heredaegu)"
              className="px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="페이지 제목 (예: 히어대구)"
              className="px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              type="submit"
              disabled={!newSlug || !newTitle}
              className="py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50"
            >
              생성
            </button>
          </form>
        )}

        {/* Pages */}
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-10">
            로딩 중...
          </p>
        ) : pages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">
            등록된 페이지가 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {pages.map((page) => (
              <button
                key={page.id}
                onClick={() => router.push(`/admin/edit/${page.slug}`)}
                className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md active:scale-[0.99] transition-all text-left"
              >
                {page.profile ? (
                  <img
                    src={page.profile}
                    alt={page.title}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-lg font-bold">
                    {page.title[0]}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {page.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    /{page.slug}
                  </p>
                </div>
                <span className="text-gray-300 text-lg">&rsaquo;</span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
