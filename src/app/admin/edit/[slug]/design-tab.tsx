"use client";

import { useState } from "react";
import type { PageRow } from "@/lib/supabase";

const BG_COLORS = ["#f9fafb", "#e8f5e9", "#e3f2fd", "#fce4ec", "#fff8e1", "#f3e5f5", "#e0f7fa", "#ffffff"];
const BTN_COLORS = ["#000000", "#7c3aed", "#2563eb", "#ec4899", "#06b6d4", "#22c55e", "#eab308", "#ffffff"];
const BTN_SHAPES = [
  { key: "rounded", label: "둥근 모서리" },
  { key: "pill", label: "알약형" },
  { key: "square", label: "직각" },
];
const BTN_ACTIONS = [
  { key: "fill", label: "원형 채움", icon: "◎" },
  { key: "wave", label: "물결", icon: "≈" },
  { key: "shadow", label: "그림자", icon: "□" },
  { key: "none", label: "없음", icon: "✕" },
];
const FONTS = [
  { key: "pretendard", label: "프리텐다드" },
  { key: "noto-sans", label: "노토산스" },
  { key: "gothic", label: "고딕" },
  { key: "nanum-gothic", label: "나눔고딕" },
  { key: "nanum-square", label: "나눔스퀘어" },
  { key: "gmarket", label: "지마켓산스" },
];

export default function DesignTab({
  page,
  onSave,
}: {
  page: PageRow;
  onSave: (updates: Partial<PageRow>) => Promise<void>;
}) {
  const [bgColor, setBgColor] = useState(page.bg_color || "#f9fafb");
  const [hoverColor, setHoverColor] = useState(page.hover_color || "#e5e7eb");
  const [btnColor, setBtnColor] = useState(page.btn_color || "#ffffff");
  const [btnShape, setBtnShape] = useState(page.btn_shape || "rounded");
  const [btnAction, setBtnAction] = useState(page.btn_action || "fill");
  const [font, setFont] = useState(page.font || "pretendard");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({ bg_color: bgColor, hover_color: hoverColor, btn_color: btnColor, btn_shape: btnShape, btn_action: btnAction, font });
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">디자인</h2>
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      {/* 배경색 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">배경색</h3>
        <div className="flex gap-2 flex-wrap">
          {BG_COLORS.map((c) => (
            <button key={c} onClick={() => setBgColor(c)}
              className={`w-14 h-14 rounded-xl border-2 transition-all ${bgColor === c ? "border-blue-500 scale-105" : "border-gray-200"}`}
              style={{ backgroundColor: c }} />
          ))}
          <div className="flex items-center gap-1">
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
              className="w-14 h-14 rounded-xl cursor-pointer border-2 border-gray-200" />
          </div>
        </div>
      </section>

      {/* 호버 색상 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">마우스오버 반응 색상</h3>
        <div className="flex items-center gap-3">
          <input type="color" value={hoverColor} onChange={(e) => setHoverColor(e.target.value)}
            className="w-14 h-14 rounded-xl cursor-pointer border-2 border-gray-200" />
          <span className="text-xs text-gray-500">{hoverColor}</span>
        </div>
      </section>

      {/* 버튼색 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">버튼색</h3>
        <div className="flex gap-2 flex-wrap">
          {BTN_COLORS.map((c) => (
            <button key={c} onClick={() => setBtnColor(c)}
              className={`w-10 h-10 rounded-full border-2 transition-all ${btnColor === c ? "border-blue-500 scale-110 ring-2 ring-blue-200" : "border-gray-200"}`}
              style={{ backgroundColor: c }} />
          ))}
          <input type="color" value={btnColor} onChange={(e) => setBtnColor(e.target.value)}
            className="w-10 h-10 rounded-full cursor-pointer border-2 border-gray-200" />
        </div>
      </section>

      {/* 버튼 모양 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">버튼 모양</h3>
        <div className="flex gap-3">
          {BTN_SHAPES.map((s) => (
            <button key={s.key} onClick={() => setBtnShape(s.key)}
              className={`flex-1 py-4 border-2 transition-all ${btnShape === s.key ? "border-gray-900 bg-gray-50" : "border-gray-200"}`}
              style={{ borderRadius: s.key === "pill" ? "9999px" : s.key === "rounded" ? "12px" : "4px" }}>
              <div className={`mx-auto w-24 h-3 bg-gray-300`} style={{ borderRadius: s.key === "pill" ? "9999px" : s.key === "rounded" ? "4px" : "0" }} />
              <p className="text-[10px] text-gray-500 mt-2">{s.label}</p>
            </button>
          ))}
        </div>
      </section>

      {/* 버튼 액션 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">버튼 액션</h3>
        <div className="flex gap-2">
          {BTN_ACTIONS.map((a) => (
            <button key={a.key} onClick={() => setBtnAction(a.key)}
              className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-lg transition-all ${btnAction === a.key ? "border-gray-900 bg-gray-50" : "border-gray-200 text-gray-400"}`}>
              {a.icon}
            </button>
          ))}
        </div>
      </section>

      {/* 폰트 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">폰트</h3>
        <div className="grid grid-cols-3 gap-2">
          {FONTS.map((f) => (
            <button key={f.key} onClick={() => setFont(f.key)}
              className={`py-3 px-3 rounded-xl border-2 text-xs font-medium transition-all ${font === f.key ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
