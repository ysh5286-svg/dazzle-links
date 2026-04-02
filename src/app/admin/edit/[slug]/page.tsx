"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import type { PageRow, LinkRow, SocialRow } from "@/lib/supabase";

const PLATFORMS = [
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "naver",
  "kakaotalk",
];

export default function EditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const [page, setPage] = useState<PageRow | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [socials, setSocials] = useState<SocialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit states
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [profile, setProfile] = useState("");

  useEffect(() => {
    fetchAll();
  }, [slug]);

  async function fetchAll() {
    const res = await fetch(`/api/pages/${slug}`);
    if (!res.ok) {
      router.push("/admin");
      return;
    }
    const data = await res.json();
    setPage(data.page);
    setLinks(data.links);
    setSocials(data.socials);
    setTitle(data.page.title);
    setDesc(data.page.desc || "");
    setProfile(data.page.profile || "");
    setLoading(false);
  }

  async function savePageInfo() {
    setSaving(true);
    await fetch(`/api/pages/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, desc, profile }),
    });
    setSaving(false);
  }

  // --- Link CRUD ---
  async function addLink() {
    const res = await fetch(`/api/pages/${slug}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: "새 링크",
        url: "https://",
        sort_order: links.length,
      }),
    });
    if (res.ok) fetchAll();
  }

  async function updateLink(id: string, updates: Partial<LinkRow>) {
    await fetch(`/api/pages/${slug}/links`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
  }

  async function deleteLink(id: string) {
    await fetch(`/api/pages/${slug}/links`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setLinks(links.filter((l) => l.id !== id));
  }

  // --- Social CRUD ---
  async function addSocial() {
    const res = await fetch(`/api/pages/${slug}/socials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "instagram",
        url: "https://",
        sort_order: socials.length,
      }),
    });
    if (res.ok) fetchAll();
  }

  async function updateSocial(id: string, updates: Partial<SocialRow>) {
    await fetch(`/api/pages/${slug}/socials`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
  }

  async function deleteSocial(id: string) {
    await fetch(`/api/pages/${slug}/socials`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setSocials(socials.filter((s) => s.id !== id));
  }

  // --- Delete Page ---
  async function deletePage() {
    if (!confirm(`"${title}" 페이지를 삭제하시겠습니까?`)) return;
    await fetch(`/api/pages/${slug}`, { method: "DELETE" });
    router.push("/admin");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => router.push("/admin")}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; 목록으로
        </button>
        <h1 className="text-base font-bold text-gray-900">{title}</h1>
        <a
          href={`/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-500 hover:text-blue-700"
        >
          미리보기
        </a>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Profile Section */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">
            프로필 정보
          </h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">설명</label>
              <input
                type="text"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                프로필 이미지 URL
              </label>
              <input
                type="text"
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                placeholder="https://example.com/image.png"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <button
              onClick={savePageInfo}
              disabled={saving}
              className="py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {saving ? "저장 중..." : "프로필 저장"}
            </button>
          </div>
        </section>

        {/* SNS Section */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">SNS 연결</h2>
            <button
              onClick={addSocial}
              className="text-sm text-blue-500 hover:text-blue-700 font-medium"
            >
              + 추가
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {socials.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <select
                  value={s.platform}
                  onChange={(e) => {
                    const updated = socials.map((x) =>
                      x.id === s.id ? { ...x, platform: e.target.value } : x
                    );
                    setSocials(updated);
                    updateSocial(s.id, { platform: e.target.value });
                  }}
                  className="px-3 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  defaultValue={s.url}
                  onBlur={(e) => updateSocial(s.id, { url: e.target.value })}
                  placeholder="https://..."
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  onClick={() => deleteSocial(s.id)}
                  className="px-3 py-3 text-red-400 hover:text-red-600 text-sm"
                >
                  삭제
                </button>
              </div>
            ))}
            {socials.length === 0 && (
              <p className="text-sm text-gray-300 text-center py-4">
                등록된 SNS가 없습니다
              </p>
            )}
          </div>
        </section>

        {/* Links Section */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">링크 관리</h2>
            <button
              onClick={addLink}
              className="text-sm text-blue-500 hover:text-blue-700 font-medium"
            >
              + 링크 추가
            </button>
          </div>
          <div className="flex flex-col gap-4">
            {links.map((link) => (
              <div
                key={link.id}
                className="border border-gray-100 rounded-xl p-4 flex flex-col gap-2"
              >
                <div>
                  <label className="text-xs text-gray-400">대표문구</label>
                  <input
                    type="text"
                    defaultValue={link.label}
                    onBlur={(e) =>
                      updateLink(link.id, { label: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">연결 URL</label>
                  <input
                    type="text"
                    defaultValue={link.url}
                    onBlur={(e) =>
                      updateLink(link.id, { url: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">
                    썸네일 이미지 URL (선택)
                  </label>
                  <input
                    type="text"
                    defaultValue={link.thumbnail || ""}
                    onBlur={(e) =>
                      updateLink(link.id, {
                        thumbnail: e.target.value || null,
                      })
                    }
                    placeholder="https://example.com/thumb.png"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <button
                  onClick={() => deleteLink(link.id)}
                  className="self-end text-xs text-red-400 hover:text-red-600"
                >
                  이 링크 삭제
                </button>
              </div>
            ))}
            {links.length === 0 && (
              <p className="text-sm text-gray-300 text-center py-4">
                등록된 링크가 없습니다
              </p>
            )}
          </div>
        </section>

        {/* Danger Zone */}
        <section className="border border-red-100 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-red-500 mb-3">위험 영역</h2>
          <button
            onClick={deletePage}
            className="px-4 py-2 border border-red-300 text-red-500 text-sm rounded-xl hover:bg-red-50 transition-colors"
          >
            이 페이지 삭제
          </button>
        </section>
      </main>
    </div>
  );
}
