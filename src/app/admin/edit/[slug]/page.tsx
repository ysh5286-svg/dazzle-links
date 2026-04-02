"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PageRow, LinkRow, SocialRow } from "@/lib/supabase";
import PageSwitcher from "./page-switcher";
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

const PLATFORMS = ["instagram", "facebook", "tiktok", "youtube", "naver", "kakaotalk"];
const PLATFORM_LABELS: Record<string, string> = {
  instagram: "인스타그램", facebook: "페이스북", tiktok: "틱톡",
  youtube: "유튜브", naver: "네이버", kakaotalk: "카카오톡",
};

// --- Small Components ---

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`w-5 h-5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function DotMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="p-1 text-gray-400 hover:text-gray-600">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 w-32 bg-white rounded-xl shadow-lg border border-gray-100 z-40 overflow-hidden">
            <button onClick={() => { onDelete(); setOpen(false); }} className="w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 text-left">블럭 삭제</button>
          </div>
        </>
      )}
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(!enabled); }}
      className={`w-10 h-[22px] rounded-full relative transition-colors ${enabled ? "bg-green-500" : "bg-gray-300"}`}
    >
      <div className={`w-4 h-4 bg-white rounded-full absolute top-[3px] transition-transform ${enabled ? "translate-x-[22px]" : "translate-x-[3px]"}`} />
      <span className="absolute -left-7 text-[10px] font-bold text-gray-400">{enabled ? "ON" : "OFF"}</span>
    </button>
  );
}

function DragHandle() {
  return (
    <div className="cursor-grab active:cursor-grabbing touch-none text-gray-300 hover:text-gray-500 px-1">
      <svg className="w-4 h-5" viewBox="0 0 16 20" fill="currentColor">
        <circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="4" r="1.5" />
        <circle cx="5" cy="10" r="1.5" /><circle cx="11" cy="10" r="1.5" />
        <circle cx="5" cy="16" r="1.5" /><circle cx="11" cy="16" r="1.5" />
      </svg>
    </div>
  );
}

function LayoutSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const layouts = [
    { key: "small", label: "작은 카드" },
    { key: "medium", label: "중간 카드" },
    { key: "large", label: "큰 카드" },
  ];
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-2 block">레이아웃</label>
      <div className="flex gap-2">
        {layouts.map((l) => (
          <button
            key={l.key}
            onClick={() => onChange(l.key)}
            className={`flex-1 py-3 rounded-lg text-xs font-medium border-2 transition-all ${value === l.key
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Block Add Modal ---

function BlockAddModal({ onClose, onSelect }: { onClose: () => void; onSelect: (type: string) => void }) {
  const blocks = [
    { type: "link", label: "단일 링크", desc: "하나의 URL 강조", color: "bg-orange-100 text-orange-600", icon: "L" },
    { type: "sns", label: "SNS 연결", desc: "소셜 채널 연결", color: "bg-green-100 text-green-600", icon: "S" },
    { type: "spacer", label: "여백", desc: "블럭 간격 조절", color: "bg-purple-100 text-purple-600", icon: "—" },
    { type: "text", label: "텍스트", desc: "글 작성", color: "bg-blue-100 text-blue-600", icon: "T" },
  ];
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-base font-bold text-gray-900 text-center mb-5">블럭 추가</h3>
          <p className="text-xs text-gray-400 mb-3">콘텐츠</p>
          <div className="grid grid-cols-3 gap-3">
            {blocks.map((b) => (
              <button
                key={b.type}
                onClick={() => onSelect(b.type)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                <div className={`w-10 h-10 rounded-xl ${b.color} flex items-center justify-center text-sm font-bold`}>
                  {b.icon}
                </div>
                <span className="text-xs font-semibold text-gray-800">{b.label}</span>
                <span className="text-[10px] text-gray-400">{b.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// --- Toast ---

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 2000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-full shadow-lg z-50">
      {message}
    </div>
  );
}

// --- Sortable Link Block ---

function SortableLinkBlock({
  link, isOpen, onToggleOpen, onUpdate, onDelete, onToggleEnabled,
}: {
  link: LinkRow;
  isOpen: boolean;
  onToggleOpen: () => void;
  onUpdate: (id: string, updates: Partial<LinkRow>) => void;
  onDelete: (id: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto" as const,
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-3 py-3.5">
        {/* Drag Handle */}
        <div {...attributes} {...listeners}>
          <DragHandle />
        </div>

        {/* ON/OFF Toggle */}
        <div className="ml-1.5 mr-2">
          <Toggle enabled={link.enabled} onChange={(v) => onToggleEnabled(link.id, v)} />
        </div>

        {/* Title - clickable to expand */}
        <button onClick={onToggleOpen} className="flex-1 flex items-center gap-2 text-left min-w-0">
          <span className={`text-sm font-semibold truncate ${link.enabled ? "text-gray-800" : "text-gray-300"}`}>단일 링크</span>
          <span className={`text-sm truncate ${link.enabled ? "text-gray-500" : "text-gray-300"}`}>{link.label}</span>
        </button>

        {/* Right actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <DotMenu onDelete={() => onDelete(link.id)} />
          <button onClick={onToggleOpen}><Chevron open={isOpen} /></button>
        </div>
      </div>

      {/* Expanded Content */}
      {isOpen && (
        <div className="px-5 pb-5 flex flex-col gap-3 border-t border-gray-50 pt-4">
          <div>
            <label className="text-xs font-medium text-red-400 mb-1 block">연결 URL *</label>
            <input type="text" defaultValue={link.url} onBlur={(e) => onUpdate(link.id, { url: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">대표문구</label>
            <input type="text" defaultValue={link.label} onBlur={(e) => onUpdate(link.id, { label: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">썸네일 이미지 URL</label>
            <input type="text" defaultValue={link.thumbnail || ""} onBlur={(e) => onUpdate(link.id, { thumbnail: e.target.value || null })}
              placeholder="https://example.com/thumb.png"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <LayoutSelector value={link.layout || "small"} onChange={(v) => onUpdate(link.id, { layout: v })} />
        </div>
      )}
    </div>
  );
}

// --- Main Page ---

export default function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [page, setPage] = useState<PageRow | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [socials, setSocials] = useState<SocialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [toast, setToast] = useState("");

  const [openProfile, setOpenProfile] = useState(false);
  const [openSns, setOpenSns] = useState(false);
  const [openLinks, setOpenLinks] = useState<Record<string, boolean>>({});

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [profile, setProfile] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const fetchAll = useCallback(async () => {
    const res = await fetch(`/api/pages/${slug}`);
    if (!res.ok) { router.push("/admin"); return; }
    const data = await res.json();
    setPage(data.page);
    setLinks(data.links);
    setSocials(data.socials);
    setTitle(data.page.title);
    setDesc(data.page.desc || "");
    setProfile(data.page.profile || "");
    setLoading(false);
  }, [slug, router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  function refreshPreview() { setPreviewKey((k) => k + 1); }

  async function savePageInfo() {
    setSaving(true);
    await fetch(`/api/pages/${slug}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, desc, profile }) });
    setSaving(false);
    refreshPreview();
  }

  async function addLink() {
    await fetch(`/api/pages/${slug}/links`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "새 링크", url: "https://", sort_order: links.length, layout: "small", enabled: true }),
    });
    await fetchAll();
    refreshPreview();
  }

  async function updateLink(id: string, updates: Partial<LinkRow>) {
    setLinks((prev) => prev.map((l) => l.id === id ? { ...l, ...updates } : l));
    await fetch(`/api/pages/${slug}/links`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...updates }) });
    refreshPreview();
  }

  async function deleteLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/pages/${slug}/links`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    refreshPreview();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = links.findIndex((l) => l.id === active.id);
    const newIndex = links.findIndex((l) => l.id === over.id);
    const reordered = arrayMove(links, oldIndex, newIndex);
    setLinks(reordered);
    // Update sort_order for all
    await Promise.all(reordered.map((link, i) =>
      fetch(`/api/pages/${slug}/links`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: link.id, sort_order: i }) })
    ));
    refreshPreview();
  }

  async function addSocial() {
    await fetch(`/api/pages/${slug}/socials`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform: "instagram", url: "https://", sort_order: socials.length }) });
    await fetchAll(); refreshPreview();
  }
  async function updateSocial(id: string, updates: Partial<SocialRow>) {
    await fetch(`/api/pages/${slug}/socials`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...updates }) });
    refreshPreview();
  }
  async function deleteSocial(id: string) {
    setSocials((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/pages/${slug}/socials`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    refreshPreview();
  }
  async function deletePage() {
    if (!confirm(`"${title}" 페이지를 삭제하시겠습니까?`)) return;
    await fetch(`/api/pages/${slug}`, { method: "DELETE" });
    router.push("/admin");
  }

  function handleBlockSelect(type: string) {
    setShowBlockModal(false);
    if (type === "link") {
      addLink();
    } else if (type === "sns") {
      addSocial();
      setOpenSns(true);
    } else {
      setToast("준비 중인 기능입니다");
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]"><p className="text-sm text-gray-400">로딩 중...</p></div>;
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col">
      <PageSwitcher currentSlug={slug} currentProfile={profile} />
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
      {showBlockModal && <BlockAddModal onClose={() => setShowBlockModal(false)} onSelect={handleBlockSelect} />}

      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 z-10">
        <span className="text-xs text-gray-400">/{slug}</span>
        <h1 className="text-sm font-bold text-gray-900">{title}</h1>
        <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-700 font-medium">미리보기 &rarr;</a>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Phone Preview */}
        <div className="w-[420px] shrink-0 flex items-start justify-center py-8 px-6">
          <div className="w-[375px] h-[720px] bg-white rounded-[40px] shadow-xl border border-gray-200 overflow-hidden relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-black rounded-b-2xl z-10" />
            <iframe key={previewKey} src={`/${slug}`} className="w-full h-full border-0" title="미리보기" />
          </div>
        </div>

        {/* Right: Settings */}
        <div className="flex-1 bg-[#f5f6f8] overflow-y-auto py-6 px-5">
          <div className="max-w-xl mx-auto flex flex-col gap-3">

            {/* 프로필 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button onClick={() => setOpenProfile(!openProfile)} className="w-full flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold">P</span>
                  <span className="text-sm font-semibold text-gray-800">프로필</span>
                </div>
                <Chevron open={openProfile} />
              </button>
              {openProfile && (
                <div className="px-5 pb-5 flex flex-col gap-3 border-t border-gray-50 pt-4">
                  {profile && <div className="flex justify-center"><img src={profile} alt="프로필" className="w-20 h-20 rounded-full object-cover" /></div>}
                  <div><label className="text-xs font-medium text-gray-500 mb-1 block">대표문구</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" /></div>
                  <div><label className="text-xs font-medium text-gray-500 mb-1 block">상세문구</label><input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="추가 설명" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" /></div>
                  <div><label className="text-xs font-medium text-gray-500 mb-1 block">이미지 URL</label><input type="text" value={profile} onChange={(e) => setProfile(e.target.value)} placeholder="https://..." className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" /></div>
                  <button onClick={savePageInfo} disabled={saving} className="self-end px-6 py-2 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">{saving ? "저장 중..." : "저장"}</button>
                </div>
              )}
            </div>

            {/* SNS 연결 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button onClick={() => setOpenSns(!openSns)} className="w-full flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold">S</span>
                  <span className="text-sm font-semibold text-gray-800">SNS 연결</span>
                </div>
                <Chevron open={openSns} />
              </button>
              {openSns && (
                <div className="px-5 pb-5 flex flex-col gap-2.5 border-t border-gray-50 pt-4">
                  {socials.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                      <select value={s.platform} onChange={(e) => { setSocials(socials.map((x) => x.id === s.id ? { ...x, platform: e.target.value } : x)); updateSocial(s.id, { platform: e.target.value }); }} className="w-24 px-2 py-2 border border-gray-200 rounded-lg text-xs bg-white">
                        {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
                      </select>
                      <input type="text" defaultValue={s.url} onBlur={(e) => updateSocial(s.id, { url: e.target.value })} placeholder="https://..." className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900" />
                      <button onClick={() => deleteSocial(s.id)} className="text-gray-300 hover:text-red-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))}
                  <button onClick={addSocial} className="w-full py-2.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 mt-1">+ SNS 연결추가</button>
                </div>
              )}
            </div>

            {/* 링크 블록들 - 드래그앤드롭 */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                {links.map((link) => (
                  <SortableLinkBlock
                    key={link.id}
                    link={link}
                    isOpen={!!openLinks[link.id]}
                    onToggleOpen={() => setOpenLinks({ ...openLinks, [link.id]: !openLinks[link.id] })}
                    onUpdate={updateLink}
                    onDelete={deleteLink}
                    onToggleEnabled={(id, enabled) => updateLink(id, { enabled })}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* + 블럭 추가 */}
            <button onClick={() => setShowBlockModal(true)} className="w-full py-3.5 bg-gray-900 text-white text-sm font-medium rounded-2xl hover:bg-gray-800 active:scale-[0.99] transition-all">
              + 블럭 추가
            </button>

            <button onClick={deletePage} className="w-full py-2.5 text-xs text-red-400 hover:text-red-600 mt-2">이 페이지 삭제</button>
          </div>
        </div>
      </div>
    </div>
  );
}
