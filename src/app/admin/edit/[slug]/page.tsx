"use client";

import { useEffect, useState, useRef, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { PageRow, LinkRow, SocialRow } from "@/lib/supabase";
import PageSwitcher from "./page-switcher";
import DesignTab from "./design-tab";
import AdminChannelBar from "./admin-channel-bar";
import AnalyticsTab from "./analytics-tab";
import GroupLinkEditor from "./group-link-editor";
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

const PLATFORMS = ["instagram", "facebook", "tiktok", "youtube", "naver", "kakaotalk", "website"];
const PLATFORM_LABELS: Record<string, string> = {
  instagram: "인스타그램", facebook: "페이스북", tiktok: "틱톡",
  youtube: "유튜브", naver: "네이버", kakaotalk: "카카오톡", website: "홈페이지",
};

// --- Small Components ---

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`w-5 h-5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function DotMenu({ onDelete, onCopy, onCopyToPage }: { onDelete: () => void; onCopy: () => void; onCopyToPage: (targetSlug: string) => void }) {
  const [open, setOpen] = useState(false);
  const [showPages, setShowPages] = useState(false);
  const [pages, setPages] = useState<{ slug: string; title: string }[]>([]);

  function handleCopyTo() {
    setShowPages(true);
    fetch("/api/pages").then((r) => r.json()).then(setPages);
  }

  return (
    <div className="relative">
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); setShowPages(false); }} className="p-1 text-gray-400 hover:text-gray-600">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => { setOpen(false); setShowPages(false); }} />
          <div className="absolute right-0 top-8 w-48 bg-white rounded-xl shadow-lg border border-gray-100 z-40 overflow-hidden">
            <button onClick={() => { onCopy(); setOpen(false); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">블럭 복사 (현재 페이지)</button>
            <button onClick={handleCopyTo} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">다른 페이지로 복사 &rarr;</button>
            {showPages && (
              <div className="border-t border-gray-100 max-h-[200px] overflow-y-auto">
                {pages.map((p) => (
                  <button key={p.slug} onClick={() => { onCopyToPage(p.slug); setOpen(false); setShowPages(false); }}
                    className="w-full px-4 py-2 text-xs text-gray-600 hover:bg-blue-50 text-left truncate">{p.title}</button>
                ))}
              </div>
            )}
            <button onClick={() => { onDelete(); setOpen(false); }} className="w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 text-left border-t border-gray-100">블럭 삭제</button>
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

// --- Spacer Editor ---

function SpacerEditor({ height, lineStyle, onChange }: { height: number; lineStyle: string; onChange: (h: number, ls: string) => void }) {
  const [h, setH] = useState(height);
  const [ls, setLs] = useState(lineStyle);
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function updateFromX(clientX: number) {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const val = Math.round(ratio * 200);
    setH(val);
  }

  function handlePointerDown(e: React.PointerEvent) {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromX(e.clientX);
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    updateFromX(e.clientX);
  }
  function handlePointerUp(e: React.PointerEvent) {
    if (!dragging.current) return;
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    onChange(h, ls);
  }

  const lines = [
    { key: "none", label: "선 없음", preview: <span className="text-base">✕</span> },
    { key: "dotted", label: "점선", preview: <span className="border-t-2 border-dotted border-gray-400 w-10 block" /> },
    { key: "solid", label: "실선", preview: <span className="border-t-2 border-gray-800 w-10 block" /> },
    { key: "wave", label: "물결", preview: <span className="text-[10px] text-gray-500 tracking-tighter">∿∿∿∿∿</span> },
    { key: "zigzag", label: "지그재그", preview: <span className="text-[10px] text-gray-500 tracking-tighter">⩘⩘⩘⩘⩘</span> },
  ];

  return (
    <div className="px-5 pb-5 flex flex-col gap-4 border-t border-gray-50 pt-4">
      <div>
        <label className="text-xs font-medium text-gray-500 mb-2 block">구분선</label>
        <div className="grid grid-cols-5 gap-2">
          {lines.map((l) => (
            <button key={l.key} onClick={() => { setLs(l.key); onChange(h, l.key); }}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-all ${ls === l.key ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>
              <div className="h-5 flex items-center justify-center">{l.preview}</div>
              <span className="text-[10px] text-gray-500">{l.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-2 block">여백 조절</label>
        <div className="flex items-center gap-3">
          <div ref={barRef} className="flex-1 h-7 bg-gray-200 rounded-full relative cursor-pointer touch-none select-none"
            onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
            <div className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-[width]" style={{ width: `${(h / 200) * 100}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-blue-500 rounded-full shadow-sm transition-[left]" style={{ left: `calc(${(h / 200) * 100}% - 10px)` }} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <input type="number" value={h} onChange={(e) => { const v = Math.max(0, Math.min(200, parseInt(e.target.value) || 0)); setH(v); onChange(v, ls); }}
              className="w-14 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-center focus:outline-none focus:ring-2 focus:ring-gray-900" />
            <span className="text-xs text-gray-400">px</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Text Editor ---

function TextEditor({ link, onUpdate }: { link: LinkRow; onUpdate: (id: string, updates: Partial<LinkRow>) => void }) {
  const opts = (() => { try { return JSON.parse(link.thumbnail || "{}"); } catch { return {}; } })();
  const [align, setAlign] = useState(opts.align || "center");
  const [size, setSize] = useState(opts.size || "sm");
  const [textLayout, setTextLayout] = useState(opts.textLayout || "plain");
  const [showOptions, setShowOptions] = useState(false);

  function saveOpts(a: string, s: string, tl: string) {
    onUpdate(link.id, { thumbnail: JSON.stringify({ align: a, size: s, textLayout: tl }) });
  }

  return (
    <div className="px-5 pb-5 flex flex-col gap-3 border-t border-gray-50 pt-4">
      <div>
        <label className="text-xs font-medium text-red-400 mb-1 block">대표문구 *</label>
        <input type="text" defaultValue={link.label} onBlur={(e) => onUpdate(link.id, { label: e.target.value })}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
      </div>
      <div>
        <label className="text-xs font-medium text-red-400 mb-1 block">상세문구 *</label>
        <textarea defaultValue={link.url} onBlur={(e) => onUpdate(link.id, { url: e.target.value })} rows={3}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
      </div>
      <button onClick={() => setShowOptions(!showOptions)} className="self-end text-xs text-gray-500 hover:text-gray-700 font-medium">
        옵션 {showOptions ? "접기" : "펼치기"} {showOptions ? "∧" : "∨"}
      </button>
      {showOptions && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">레이아웃</label>
            <div className="flex gap-3">
              {[
                { key: "plain", label: "기본 나열형", icon: <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 6h16M4 12h16M4 18h10" /></svg> },
                { key: "toggle", label: "토글 접기형", icon: <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7 8h10M7 12h6" /><path d="M16 11l2 2-2 2" /></svg> },
              ].map((l) => (
                <button key={l.key} onClick={() => { setTextLayout(l.key); saveOpts(align, size, l.key); }}
                  className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all ${textLayout === l.key ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 hover:border-gray-300"}`}>
                  <div className={textLayout === l.key ? "text-white [&_svg]:text-white" : ""}>{l.icon}</div>
                  <span className="text-[10px] font-medium">{l.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">정렬</label>
            <div className="flex gap-2">
              {[
                { key: "left", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 6h16M4 12h10M4 18h14" /></svg> },
                { key: "center", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 6h16M7 12h10M5 18h14" /></svg> },
                { key: "right", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 6h16M10 12h10M6 18h14" /></svg> },
              ].map((a) => (
                <button key={a.key} onClick={() => { setAlign(a.key); saveOpts(a.key, size, textLayout); }}
                  className={`flex-1 py-2.5 rounded-lg border-2 flex items-center justify-center transition-all ${align === a.key ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                  {a.icon}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">글자 크기</label>
            <div className="flex gap-2">
              {[{ key: "sm", label: "소" }, { key: "md", label: "중" }, { key: "lg", label: "대" }].map((s) => (
                <button key={s.key} onClick={() => { setSize(s.key); saveOpts(align, s.key, textLayout); }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold border-2 transition-all ${size === s.key ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Video Editor ---

function VideoEditor({ link, onUpdate }: { link: LinkRow; onUpdate: (id: string, updates: Partial<LinkRow>) => void }) {
  const urls: string[] = (() => { try { return JSON.parse(link.url || "[]"); } catch { return []; } })();
  const [videoUrls, setVideoUrls] = useState<string[]>(urls.length ? urls : [""]);
  const [videoLayout, setVideoLayout] = useState(link.label || "grid");
  const [showOptions, setShowOptions] = useState(false);

  function saveUrls(newUrls: string[]) {
    setVideoUrls(newUrls);
    onUpdate(link.id, { url: JSON.stringify(newUrls.filter((u) => u.trim())) });
  }

  function updateUrl(index: number, value: string) {
    const newUrls = [...videoUrls];
    newUrls[index] = value;
    setVideoUrls(newUrls);
  }

  function saveUrl(index: number) {
    onUpdate(link.id, { url: JSON.stringify(videoUrls.filter((u) => u.trim())) });
  }

  function addUrl() {
    setVideoUrls([...videoUrls, ""]);
  }

  function removeUrl(index: number) {
    const newUrls = videoUrls.filter((_, i) => i !== index);
    saveUrls(newUrls.length ? newUrls : [""]);
  }

  const layouts = [
    { key: "single", label: "기본 배치", icon: <div className="w-12 h-12 border-2 border-gray-300 rounded-lg flex items-center justify-center"><div className="w-8 h-8 bg-gray-200 rounded" /></div> },
    { key: "carousel", label: "캐러셀", icon: <div className="w-12 h-12 border-2 border-gray-300 rounded-lg flex items-center justify-center gap-0.5"><div className="w-5 h-8 bg-gray-200 rounded" /><div className="w-3 h-8 bg-gray-100 rounded" /></div> },
    { key: "grid", label: "2열 배치", icon: <div className="w-12 h-12 border-2 border-gray-300 rounded-lg grid grid-cols-2 gap-0.5 p-1"><div className="bg-gray-200 rounded" /><div className="bg-gray-200 rounded" /><div className="bg-gray-200 rounded" /><div className="bg-gray-200 rounded" /></div> },
  ];

  return (
    <div className="px-5 pb-5 flex flex-col gap-3 border-t border-gray-50 pt-4">
      <label className="text-xs font-medium text-gray-500 mb-1 block">동영상 주소</label>
      {videoUrls.map((url, i) => (
        <div key={i} className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-300 shrink-0" viewBox="0 0 16 20" fill="currentColor">
            <circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="4" r="1.5" />
            <circle cx="5" cy="10" r="1.5" /><circle cx="11" cy="10" r="1.5" />
            <circle cx="5" cy="16" r="1.5" /><circle cx="11" cy="16" r="1.5" />
          </svg>
          <input type="text" value={url} onChange={(e) => updateUrl(i, e.target.value)} onBlur={() => saveUrl(i)}
            placeholder="https://www.youtube.com/shorts/..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <button onClick={() => removeUrl(i)} className="text-gray-300 hover:text-red-500 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      ))}
      <button onClick={addUrl} className="w-full py-2.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800">+ 동영상 추가</button>

      <button onClick={() => setShowOptions(!showOptions)} className="self-end text-xs text-gray-500 hover:text-gray-700 font-medium">
        옵션 {showOptions ? "접기" : "펼치기"} {showOptions ? "∧" : "∨"}
      </button>
      {showOptions && (
        <div>
          <label className="text-xs font-medium text-gray-500 mb-2 block">레이아웃</label>
          <div className="flex gap-3">
            {layouts.map((l) => (
              <button key={l.key} onClick={() => { setVideoLayout(l.key); onUpdate(link.id, { label: l.key }); }}
                className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-xl border-2 transition-all ${videoLayout === l.key ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>
                {l.icon}
                <span className="text-[10px] text-gray-500 font-medium">{l.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Block Add Modal ---

function BlockAddModal({ onClose, onSelect }: { onClose: () => void; onSelect: (type: string) => void }) {
  const blocks = [
    { type: "link", label: "단일 링크", desc: "하나의 URL 강조", color: "bg-orange-100 text-orange-600", icon: "L" },
    { type: "group", label: "그룹 링크", desc: "여러 링크 묶음", color: "bg-pink-100 text-pink-600", icon: "G" },
    { type: "kakaotalk", label: "카톡 채팅", desc: "실시간 채팅 버튼", color: "bg-yellow-100 text-yellow-700", icon: "K" },
    { type: "sns", label: "SNS 연결", desc: "소셜 채널 연결", color: "bg-green-100 text-green-600", icon: "S" },
    { type: "spacer", label: "여백", desc: "블럭 간격 조절", color: "bg-purple-100 text-purple-600", icon: "—" },
    { type: "text", label: "텍스트", desc: "글 작성", color: "bg-blue-100 text-blue-600", icon: "T" },
    { type: "video", label: "동영상", desc: "유튜브 영상 임베드", color: "bg-red-100 text-red-600", icon: "▶" },
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
  link, isOpen, onToggleOpen, onUpdate, onDelete, onToggleEnabled, onCopy, onCopyToPage,
}: {
  link: LinkRow;
  isOpen: boolean;
  onToggleOpen: () => void;
  onUpdate: (id: string, updates: Partial<LinkRow>) => void;
  onDelete: (id: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onCopy: (id: string) => void;
  onCopyToPage: (id: string, targetSlug: string) => void;
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
          {link.layout === "group" ? (
            <>
              <span className="w-5 h-5 rounded bg-pink-100 flex items-center justify-center text-[10px] font-bold text-pink-600 shrink-0">G</span>
              <span className={`text-sm font-semibold truncate ${link.enabled ? "text-gray-800" : "text-gray-300"}`}>그룹 링크</span>
            </>
          ) : link.layout === "kakaotalk" ? (
            <>
              <span className="w-5 h-5 rounded bg-[#FFE812] flex items-center justify-center text-[10px] font-bold text-[#3C1E1E] shrink-0">K</span>
              <span className={`text-sm font-semibold truncate ${link.enabled ? "text-gray-800" : "text-gray-300"}`}>카톡 채팅</span>
            </>
          ) : link.layout === "spacer" ? (
            <>
              <span className="w-5 h-5 rounded bg-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-600 shrink-0">—</span>
              <span className={`text-sm font-semibold truncate ${link.enabled ? "text-gray-800" : "text-gray-300"}`}>여백</span>
              <span className={`text-xs ${link.enabled ? "text-gray-400" : "text-gray-300"}`}>{link.label}px</span>
            </>
          ) : link.layout === "text" ? (
            <>
              <span className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 shrink-0">T</span>
              <span className={`text-sm font-semibold truncate ${link.enabled ? "text-gray-800" : "text-gray-300"}`}>텍스트</span>
              <span className={`text-sm truncate ${link.enabled ? "text-gray-500" : "text-gray-300"}`}>{link.label}</span>
            </>
          ) : link.layout === "video" ? (
            <>
              <span className="w-5 h-5 rounded bg-red-100 flex items-center justify-center text-[10px] font-bold text-red-600 shrink-0">▶</span>
              <span className={`text-sm font-semibold truncate ${link.enabled ? "text-gray-800" : "text-gray-300"}`}>동영상</span>
              <span className={`text-xs ${link.enabled ? "text-gray-400" : "text-gray-300"}`}>{(() => { try { return JSON.parse(link.url || "[]").length; } catch { return 0; } })()}개</span>
            </>
          ) : (
            <span className={`text-sm font-semibold truncate ${link.enabled ? "text-gray-800" : "text-gray-300"}`}>단일 링크</span>
          )}
          {link.layout !== "spacer" && link.layout !== "text" && link.layout !== "video" && <span className={`text-sm truncate ${link.enabled ? "text-gray-500" : "text-gray-300"}`}>{link.label}</span>}
        </button>

        {/* Right actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <DotMenu onDelete={() => onDelete(link.id)} onCopy={() => onCopy(link.id)} onCopyToPage={(targetSlug) => onCopyToPage(link.id, targetSlug)} />
          <button onClick={onToggleOpen}><Chevron open={isOpen} /></button>
        </div>
      </div>

      {/* Expanded Content */}
      {isOpen && link.layout === "group" ? (
        <div className="px-5 pb-5 flex flex-col gap-3 border-t border-gray-50 pt-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">대표 문구</label>
            <input type="text" defaultValue={link.label} onBlur={(e) => onUpdate(link.id, { label: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <GroupLinkEditor linkId={link.id} onRefresh={() => { /* refreshPreview is called from parent */ }} />
        </div>
      ) : isOpen && link.layout === "spacer" ? (
        <SpacerEditor height={parseInt(link.label) || 40} lineStyle={link.url || "none"}
          onChange={(h, ls) => onUpdate(link.id, { label: String(h), url: ls })} />
      ) : isOpen && link.layout === "text" ? (
        <TextEditor link={link} onUpdate={onUpdate} />
      ) : isOpen && link.layout === "video" ? (
        <VideoEditor link={link} onUpdate={onUpdate} />
      ) : isOpen && (
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
  const [previewKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState<"page" | "design" | "analytics">("page");

  const [openProfile, setOpenProfile] = useState(false);
  const [openSns, setOpenSns] = useState(false);
  const [openLinks, setOpenLinks] = useState<Record<string, boolean>>({});

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [profile, setProfile] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [category, setCategory] = useState("자사 채널");
  const [badgeColor, setBadgeColor] = useState<string | null>(null);
  const [profileRing, setProfileRing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setOpenProfile(false);
    setOpenSns(false);
    setOpenLinks({});
    const res = await fetch(`/api/pages/${slug}`);
    if (!res.ok) { router.push("/admin"); return; }
    const data = await res.json();
    setPage(data.page);
    setLinks(data.links);
    setSocials(data.socials);
    setTitle(data.page.title);
    setDesc(data.page.desc || "");
    setProfile(data.page.profile || "");
    setNewSlug(data.page.slug);
    setCategory(data.page.category || "자사 채널");
    setBadgeColor(data.page.badge_color || null);
    setProfileRing(data.page.profile_ring || false);
    setLoading(false);
  }, [slug, router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  function refreshPreview() {
    try {
      iframeRef.current?.contentWindow?.location.reload();
    } catch {
      // cross-origin fallback
      if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
    }
  }

  async function savePageInfo() {
    setSaving(true);
    const cleanSlug = newSlug.toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    const updates: Record<string, string | null | boolean> = { title, desc, profile, category, badge_color: badgeColor, profile_ring: profileRing };
    if (cleanSlug && cleanSlug !== slug) {
      updates.slug = cleanSlug;
    }
    await fetch(`/api/pages/${slug}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    setSaving(false);
    if (cleanSlug && cleanSlug !== slug) {
      router.replace(`/admin/edit/${cleanSlug}`);
    } else {
      refreshPreview();
    }
  }

  function tempId() { return "temp_" + Math.random().toString(36).slice(2); }

  async function addLink() {
    const temp: LinkRow = { id: tempId(), page_id: page!.id, label: "새 링크", url: "https://", sort_order: links.length, layout: "small", enabled: true, thumbnail: null };
    setLinks((prev) => [...prev, temp]);
    const res = await fetch(`/api/pages/${slug}/links`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: temp.label, url: temp.url, sort_order: temp.sort_order, layout: temp.layout, enabled: true }) });
    const created = await res.json();
    if (created?.id) setLinks((prev) => prev.map((l) => l.id === temp.id ? { ...l, id: created.id } : l));
    refreshPreview();
  }

  async function updateLink(id: string, updates: Partial<LinkRow>) {
    setLinks((prev) => prev.map((l) => l.id === id ? { ...l, ...updates } : l));
    fetch(`/api/pages/${slug}/links`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...updates }) })
      .then(() => refreshPreview());
  }

  async function deleteLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    fetch(`/api/pages/${slug}/links`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
      .then(() => refreshPreview());
  }

  async function copyLink(id: string) {
    const link = links.find((l) => l.id === id);
    if (!link) return;
    const temp: LinkRow = { ...link, id: tempId(), sort_order: links.length };
    setLinks((prev) => [...prev, temp]);
    setToast("블럭이 복사되었습니다");
    const res = await fetch(`/api/pages/${slug}/links`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: link.label, url: link.url, thumbnail: link.thumbnail, layout: link.layout, enabled: link.enabled, sort_order: links.length }) });
    const created = await res.json();
    if (created?.id) setLinks((prev) => prev.map((l) => l.id === temp.id ? { ...l, id: created.id } : l));
    refreshPreview();
  }

  async function copyLinkToPage(id: string, targetSlug: string) {
    const link = links.find((l) => l.id === id);
    if (!link) return;
    await fetch(`/api/pages/${targetSlug}/links`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: link.label, url: link.url, thumbnail: link.thumbnail, layout: link.layout, enabled: link.enabled, sort_order: 999 }),
    });
    setToast(`"${targetSlug}" 페이지로 복사되었습니다`);
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
    const temp: SocialRow = { id: tempId(), page_id: page!.id, platform: "instagram", url: "https://", sort_order: socials.length };
    setSocials((prev) => [...prev, temp]);
    const res = await fetch(`/api/pages/${slug}/socials`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform: "instagram", url: "https://", sort_order: socials.length }) });
    const created = await res.json();
    if (created?.id) setSocials((prev) => prev.map((s) => s.id === temp.id ? { ...s, id: created.id } : s));
    refreshPreview();
  }
  async function updateSocial(id: string, updates: Partial<SocialRow>) {
    setSocials((prev) => prev.map((s) => s.id === id ? { ...s, ...updates } : s));
    fetch(`/api/pages/${slug}/socials`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...updates }) })
      .then(() => refreshPreview());
  }
  async function deleteSocial(id: string) {
    setSocials((prev) => prev.filter((s) => s.id !== id));
    fetch(`/api/pages/${slug}/socials`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
      .then(() => refreshPreview());
  }
  async function deletePage() {
    if (!confirm(`"${title}" 페이지를 삭제하시겠습니까?`)) return;
    await fetch(`/api/pages/${slug}`, { method: "DELETE" });
    router.push("/admin");
  }

  async function addGroupBlock() {
    const data = { label: "그룹 링크", url: "", sort_order: links.length, layout: "group", enabled: true };
    const temp: LinkRow = { id: tempId(), page_id: page!.id, thumbnail: null, ...data };
    setLinks((prev) => [...prev, temp]);
    const res = await fetch(`/api/pages/${slug}/links`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const created = await res.json();
    if (created?.id) setLinks((prev) => prev.map((l) => l.id === temp.id ? { ...l, id: created.id } : l));
    // 자동으로 펼치기
    if (created?.id) setOpenLinks((prev) => ({ ...prev, [created.id]: true }));
    refreshPreview();
  }

  async function addKakaoBlock() {
    const data = { label: "카톡 문의/제보", url: "https://pf.kakao.com/", sort_order: links.length, layout: "kakaotalk", enabled: true };
    const temp: LinkRow = { id: tempId(), page_id: page!.id, thumbnail: null, ...data };
    setLinks((prev) => [...prev, temp]);
    const res = await fetch(`/api/pages/${slug}/links`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const created = await res.json();
    if (created?.id) setLinks((prev) => prev.map((l) => l.id === temp.id ? { ...l, id: created.id } : l));
    refreshPreview();
  }

  async function addVideo() {
    const data = { label: "grid", url: JSON.stringify([""]), sort_order: links.length, layout: "video", enabled: true };
    const temp: LinkRow = { id: tempId(), page_id: page!.id, thumbnail: null, ...data };
    setLinks((prev) => [...prev, temp]);
    const res = await fetch(`/api/pages/${slug}/links`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const created = await res.json();
    if (created?.id) setLinks((prev) => prev.map((l) => l.id === temp.id ? { ...l, id: created.id } : l));
    refreshPreview();
  }

  async function addText() {
    const data = { label: "텍스트 제목", url: "상세 내용을 입력하세요", sort_order: links.length, layout: "text", enabled: true, thumbnail: JSON.stringify({ align: "center", size: "sm", textLayout: "plain" }) };
    const temp: LinkRow = { id: tempId(), page_id: page!.id, ...data };
    setLinks((prev) => [...prev, temp]);
    const res = await fetch(`/api/pages/${slug}/links`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const created = await res.json();
    if (created?.id) setLinks((prev) => prev.map((l) => l.id === temp.id ? { ...l, id: created.id } : l));
    refreshPreview();
  }

  async function addSpacer() {
    const data = { label: "40", url: "", sort_order: links.length, layout: "spacer", enabled: true };
    const temp: LinkRow = { id: tempId(), page_id: page!.id, thumbnail: null, ...data };
    setLinks((prev) => [...prev, temp]);
    const res = await fetch(`/api/pages/${slug}/links`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const created = await res.json();
    if (created?.id) setLinks((prev) => prev.map((l) => l.id === temp.id ? { ...l, id: created.id } : l));
    refreshPreview();
  }

  function handleBlockSelect(type: string) {
    setShowBlockModal(false);
    if (type === "link") {
      addLink();
    } else if (type === "group") {
      addGroupBlock();
    } else if (type === "kakaotalk") {
      addKakaoBlock();
    } else if (type === "sns") {
      addSocial();
      setOpenSns(true);
    } else if (type === "spacer") {
      addSpacer();
    } else if (type === "text") {
      addText();
    } else if (type === "video") {
      addVideo();
    } else {
      setToast("준비 중인 기능입니다");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex flex-col">
        {/* Skeleton Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <div className="flex items-center gap-3">
            {[1,2,3,4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1 shrink-0">
                <div className="w-11 h-11 rounded-full bg-gray-200 animate-pulse" />
                <div className="w-10 h-2 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between">
          <div className="w-16 h-4 bg-gray-200 rounded animate-pulse" />
          <div className="w-20 h-4 bg-gray-200 rounded animate-pulse" />
          <div className="w-16 h-4 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex-1 flex">
          {/* Skeleton Phone */}
          <div className="w-[420px] shrink-0 flex items-start justify-center py-8 px-6">
            <div className="w-[375px] h-[720px] bg-white rounded-[40px] border border-gray-200 flex flex-col items-center pt-16 gap-4 px-8">
              <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse" />
              <div className="w-32 h-5 bg-gray-200 rounded animate-pulse" />
              <div className="w-48 h-3 bg-gray-100 rounded animate-pulse" />
              <div className="flex gap-3 mt-2">{[1,2,3].map((i) => <div key={i} className="w-7 h-7 rounded-full bg-gray-200 animate-pulse" />)}</div>
              <div className="w-full flex flex-col gap-3 mt-4">
                {[1,2,3].map((i) => <div key={i} className="w-full h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
              </div>
            </div>
          </div>
          {/* Skeleton Settings */}
          <div className="flex-1 bg-[#f5f6f8] py-6 px-5">
            <div className="max-w-xl mx-auto flex flex-col gap-3">
              {[1,2,3].map((i) => <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />)}
              <div className="bg-gray-900 rounded-2xl h-14 animate-pulse opacity-30" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col">
      <PageSwitcher currentSlug={slug} currentProfile={profile} />
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
      {showBlockModal && <BlockAddModal onClose={() => setShowBlockModal(false)} onSelect={handleBlockSelect} />}

      {/* Admin Channel Bar */}
      <AdminChannelBar currentSlug={slug} />

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
            <iframe ref={iframeRef} src={`/${slug}`} className="w-full h-full border-0" title="미리보기" />
          </div>
        </div>

        {/* Right: Settings */}
        <div className="flex-1 bg-[#f5f6f8] flex flex-col overflow-hidden">
          {/* Tab Navigation */}
          <div className="bg-white border-b border-gray-200 px-6 flex shrink-0">
            <button onClick={() => setActiveTab("page")}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "page" ? "border-gray-900 text-gray-900 bg-gray-900 text-white rounded-t-xl" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              페이지
            </button>
            <button onClick={() => setActiveTab("design")}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "design" ? "border-gray-900 text-gray-900 bg-gray-900 text-white rounded-t-xl" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              디자인
            </button>
            <button onClick={() => setActiveTab("analytics")}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "analytics" ? "border-gray-900 text-gray-900 bg-gray-900 text-white rounded-t-xl" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              분석
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-scroll">
            {activeTab === "analytics" ? (
              <AnalyticsTab slug={slug} linkLabels={Object.fromEntries(links.map((l) => [l.id, l.label]))} />
            ) : activeTab === "design" && page ? (
              <DesignTab page={page} onSave={async (updates) => {
                await fetch(`/api/pages/${slug}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
                await fetchAll();
                refreshPreview();
              }} />
            ) : (
          <div className="py-6 px-5">
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
                  {profile && <div className="flex justify-center"><Image src={profile} alt="프로필" width={80} height={80} className="w-20 h-20 rounded-full object-cover" /></div>}
                  <div><label className="text-xs font-medium text-gray-500 mb-1 block">대표문구</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" /></div>
                  <div><label className="text-xs font-medium text-gray-500 mb-1 block">상세문구</label><input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="추가 설명" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" /></div>
                  <div><label className="text-xs font-medium text-gray-500 mb-1 block">이미지 URL</label><input type="text" value={profile} onChange={(e) => setProfile(e.target.value)} placeholder="https://..." className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" /></div>
                  <div><label className="text-xs font-medium text-gray-500 mb-1 block">페이지 주소 (슬러그)</label><div className="flex items-center gap-1"><span className="text-xs text-gray-400 shrink-0">link.dazzlepeople.com/</span><input type="text" value={newSlug} onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))} className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" /></div></div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">프로필 링 애니메이션</label>
                    <button type="button" onClick={() => setProfileRing(!profileRing)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border-2 transition-all ${profileRing ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-500 hover:border-gray-400"}`}>
                      <div className={`w-6 h-6 rounded-full ${profileRing ? "profile-ring" : "bg-gray-200"}`} style={profileRing ? { background: "conic-gradient(#f58529, #dd2a7b, #8134af, #515bd4, #3b82f6, #58c322, #f58529)" } : {}}>
                        <div className="w-full h-full rounded-full border-2 border-white" />
                      </div>
                      {profileRing ? "ON - 그라데이션 회전" : "OFF"}
                    </button>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">검증 마크</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button type="button" onClick={() => setBadgeColor(null)}
                        className={`px-4 py-2 rounded-lg text-xs font-medium border-2 transition-all ${!badgeColor ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                        없음
                      </button>
                      {[
                        { color: "#3B82F6", label: "파랑" },
                        { color: "#EF4444", label: "빨강" },
                        { color: "#F59E0B", label: "노랑" },
                        { color: "#10B981", label: "초록" },
                        { color: "#8B5CF6", label: "보라" },
                        { color: "#EC4899", label: "핑크" },
                      ].map((b) => (
                        <button key={b.color} type="button" onClick={() => setBadgeColor(b.color)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all flex items-center gap-1.5 ${badgeColor === b.color ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-400"}`}>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill={b.color}><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.5 14.5l-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z"/></svg>
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">카테고리</label>
                    <div className="flex gap-2 flex-wrap">
                      {["자사 채널", "협업 인플루언서", "파트너"].map((c) => (
                        <button key={c} type="button" onClick={() => setCategory(c)}
                          className={`px-4 py-2 rounded-lg text-xs font-medium border-2 transition-all ${category === c ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                          {c}
                        </button>
                      ))}
                      <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="직접 입력"
                        className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900 w-28" />
                    </div>
                  </div>
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
                    onCopy={copyLink}
                    onCopyToPage={copyLinkToPage}
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
