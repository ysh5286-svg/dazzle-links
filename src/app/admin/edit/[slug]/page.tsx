"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PageRow, LinkRow, SocialRow } from "@/lib/supabase";
import PageSwitcher from "./page-switcher";

const PLATFORMS = [
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "naver",
  "kakaotalk",
];

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "인스타그램",
  facebook: "페이스북",
  tiktok: "틱톡",
  youtube: "유튜브",
  naver: "네이버",
  kakaotalk: "카카오톡",
};

type Tab = "page" | "design";

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
  const [activeTab, setActiveTab] = useState<Tab>("page");
  const [previewKey, setPreviewKey] = useState(0);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [profile, setProfile] = useState("");

  const fetchAll = useCallback(async () => {
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
  }, [slug, router]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function refreshPreview() {
    setPreviewKey((k) => k + 1);
  }

  async function savePageInfo() {
    setSaving(true);
    await fetch(`/api/pages/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, desc, profile }),
    });
    setSaving(false);
    refreshPreview();
  }

  // --- Link CRUD ---
  async function addLink() {
    await fetch(`/api/pages/${slug}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "새 링크", url: "https://", sort_order: links.length }),
    });
    await fetchAll();
    refreshPreview();
  }

  async function updateLink(id: string, updates: Partial<LinkRow>) {
    await fetch(`/api/pages/${slug}/links`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    refreshPreview();
  }

  async function deleteLink(id: string) {
    await fetch(`/api/pages/${slug}/links`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setLinks(links.filter((l) => l.id !== id));
    refreshPreview();
  }

  // --- Social CRUD ---
  async function addSocial() {
    await fetch(`/api/pages/${slug}/socials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: "instagram", url: "https://", sort_order: socials.length }),
    });
    await fetchAll();
    refreshPreview();
  }

  async function updateSocial(id: string, updates: Partial<SocialRow>) {
    await fetch(`/api/pages/${slug}/socials`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    refreshPreview();
  }

  async function deleteSocial(id: string) {
    await fetch(`/api/pages/${slug}/socials`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setSocials(socials.filter((s) => s.id !== id));
    refreshPreview();
  }

  async function deletePage() {
    if (!confirm(`"${title}" 페이지를 삭제하시겠습니까?`)) return;
    await fetch(`/api/pages/${slug}`, { method: "DELETE" });
    router.push("/admin");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
        <p className="text-sm text-gray-400">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col">
      {/* Page Switcher */}
      <PageSwitcher currentSlug={slug} currentProfile={profile} />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 z-10">
        <button
          onClick={() => router.push("/admin")}
          className="text-sm text-gray-500 hover:text-gray-700 font-medium"
        >
          &larr; 목록
        </button>
        <h1 className="text-sm font-bold text-gray-900">{title}</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">/{slug}</span>
          <button
            onClick={deletePage}
            className="text-xs text-red-400 hover:text-red-600"
          >
            삭제
          </button>
        </div>
      </header>

      {/* Main: Preview + Settings */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Phone Preview */}
        <div className="w-[420px] shrink-0 flex items-start justify-center py-8 px-6">
          <div className="w-[375px] h-[720px] bg-white rounded-[40px] shadow-xl border border-gray-200 overflow-hidden relative">
            {/* Phone notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-black rounded-b-2xl z-10" />
            <iframe
              key={previewKey}
              src={`/${slug}`}
              className="w-full h-full border-0"
              title="미리보기"
            />
          </div>
        </div>

        {/* Right: Settings Panel */}
        <div className="flex-1 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 px-6 shrink-0">
            <button
              onClick={() => setActiveTab("page")}
              className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "page"
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              페이지
            </button>
            <button
              onClick={() => setActiveTab("design")}
              className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "design"
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              관리
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "page" ? (
              <div className="flex flex-col">
                {/* Profile Section */}
                <section className="p-6 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">프로필</h3>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">제목</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">설명</label>
                      <input
                        type="text"
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">프로필 이미지 URL</label>
                      <input
                        type="text"
                        value={profile}
                        onChange={(e) => setProfile(e.target.value)}
                        placeholder="https://example.com/image.png"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                    <button
                      onClick={savePageInfo}
                      disabled={saving}
                      className="self-end px-6 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {saving ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </section>

                {/* SNS Section */}
                <section className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-800">SNS 연결</h3>
                    <button
                      onClick={addSocial}
                      className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800"
                    >
                      + SNS 추가
                    </button>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {socials.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                        <select
                          value={s.platform}
                          onChange={(e) => {
                            setSocials(socials.map((x) => x.id === s.id ? { ...x, platform: e.target.value } : x));
                            updateSocial(s.id, { platform: e.target.value });
                          }}
                          className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                        >
                          {PLATFORMS.map((p) => (
                            <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          defaultValue={s.url}
                          onBlur={(e) => updateSocial(s.id, { url: e.target.value })}
                          placeholder="https://..."
                          className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                        <button
                          onClick={() => deleteSocial(s.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {socials.length === 0 && (
                      <p className="text-xs text-gray-300 text-center py-6">등록된 SNS가 없습니다</p>
                    )}
                  </div>
                </section>

                {/* Links Section */}
                <section className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-800">단일 링크</h3>
                    <button
                      onClick={addLink}
                      className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800"
                    >
                      + 링크 추가
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {links.map((link) => (
                      <div key={link.id} className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500">단일 링크</span>
                          <button
                            onClick={() => deleteLink(link.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        <div>
                          <label className="text-xs text-red-400 mb-1 block">연결 URL *</label>
                          <input
                            type="text"
                            defaultValue={link.url}
                            onBlur={(e) => updateLink(link.id, { url: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">대표문구</label>
                          <input
                            type="text"
                            defaultValue={link.label}
                            onBlur={(e) => updateLink(link.id, { label: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">썸네일 이미지 URL</label>
                          <input
                            type="text"
                            defaultValue={link.thumbnail || ""}
                            onBlur={(e) => updateLink(link.id, { thumbnail: e.target.value || null })}
                            placeholder="https://example.com/thumb.png"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                          />
                        </div>
                      </div>
                    ))}
                    {links.length === 0 && (
                      <p className="text-xs text-gray-300 text-center py-6">등록된 링크가 없습니다</p>
                    )}
                  </div>
                </section>
              </div>
            ) : (
              /* Design/Manage Tab */
              <div className="p-6 flex flex-col gap-6">
                <section>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">페이지 정보</h3>
                  <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">슬러그</span>
                      <span className="text-gray-900 font-medium">/{slug}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">생성일</span>
                      <span className="text-gray-900">{page?.created_at ? new Date(page.created_at).toLocaleDateString("ko-KR") : "-"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">링크 수</span>
                      <span className="text-gray-900">{links.length}개</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">SNS 수</span>
                      <span className="text-gray-900">{socials.length}개</span>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-red-500 mb-3">위험 영역</h3>
                  <button
                    onClick={deletePage}
                    className="w-full py-2.5 border border-red-300 text-red-500 text-sm rounded-lg hover:bg-red-50 transition-colors"
                  >
                    이 페이지 삭제
                  </button>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
