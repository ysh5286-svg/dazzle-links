"use client";

import { useEffect } from "react";

const SHAPE_MAP: Record<string, string> = {
  rounded: "16px",
  pill: "9999px",
  square: "4px",
};

const FONT_MAP: Record<string, string> = {
  pretendard: "'Pretendard', -apple-system, sans-serif",
  "noto-sans": "'Noto Sans KR', sans-serif",
  gothic: "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
  "nanum-gothic": "'Nanum Gothic', sans-serif",
  "nanum-square": "'NanumSquare', sans-serif",
  gmarket: "'GmarketSans', sans-serif",
};

function isDark(hex: string) {
  const c = hex.replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

export default function DesignPreviewListener() {
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type !== "dazzle-design-preview") return;
      const d = e.data.design;
      if (!d) return;

      const bgColor = d.bg_color || "#f9fafb";
      const btnColor = d.btn_color || "#ffffff";
      const hoverColor = d.hover_color || "#e5e7eb";
      const btnShape = SHAPE_MAP[d.btn_shape] || "16px";
      const btnAction = d.btn_action || "fill";
      const fontFamily = FONT_MAP[d.font] || FONT_MAP.pretendard;
      const hoverTextColor = isDark(hoverColor) ? "#ffffff" : "#1f2937";

      // Update body
      document.body.style.background = bgColor;
      document.body.style.fontFamily = fontFamily;

      // Update or create style tag
      let style = document.getElementById("dazzle-preview-style") as HTMLStyleElement;
      if (!style) {
        style = document.createElement("style");
        style.id = "dazzle-preview-style";
        document.head.appendChild(style);
      }

      style.textContent = `
        .link-btn {
          background: ${btnColor} !important;
          border-radius: ${btnShape} !important;
          transition: transform 0.2s ease;
          position: relative;
          overflow: hidden;
          z-index: 0;
        }
        .link-btn::before {
          content: '';
          position: absolute;
          z-index: -1;
          transition: transform 0.5s ease, opacity 0.3s ease;
          opacity: 0;
          background: ${hoverColor};
          ${btnAction === "fill" ? `width: 300px; height: 300px; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0); border-radius: 50%;` : ""}
          ${btnAction === "wave" ? `inset: 0; transform: translateY(100%); border-radius: 50% 50% 0 0;` : ""}
          ${btnAction === "shadow" || btnAction === "none" ? "display: none;" : ""}
        }
        .link-btn:hover::before {
          opacity: 1;
          ${btnAction === "fill" ? "transform: translate(-50%, -50%) scale(3);" : ""}
          ${btnAction === "wave" ? "transform: translateY(0); border-radius: 0;" : ""}
        }
        .link-btn:hover {
          transform: scale(1.02);
          color: ${hoverTextColor};
          ${btnAction === "shadow" ? `box-shadow: 0 8px 30px ${hoverColor}50; background: ${hoverColor} !important;` : ""}
        }
        .link-btn:hover * { color: ${hoverTextColor}; }
        .link-btn:active { transform: scale(0.98); }
      `;
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}
