"use client";

export default function ChatButton({ url, label, platform = "kakao", position = "bottom-right" }: {
  url?: string;
  label?: string;
  platform?: string;
  position?: string;
}) {
  if (!url) return null;

  const text = label || (platform === "kakao" ? "카톡문의" : platform === "naver" ? "톡톡문의" : "문의하기");

  // 플랫폼별 색상
  const colors = {
    kakao: { bg: "#FFE812", text: "#3C1E1E", iconBg: "rgba(60,30,30,0.1)" },
    naver: { bg: "#03C75A", text: "#ffffff", iconBg: "rgba(255,255,255,0.2)" },
    web: { bg: "#ffffff", text: "#374151", iconBg: "rgba(0,0,0,0.05)" },
  }[platform] || { bg: "#FFE812", text: "#3C1E1E", iconBg: "rgba(60,30,30,0.1)" };

  // 위치별 클래스
  const posClass = {
    "bottom-right": "bottom-0 right-4",
    "bottom-left": "bottom-0 left-4",
    "top-right": "top-[100px] right-4",
  }[position] || "bottom-0 right-4";

  // 플랫폼별 아이콘
  const icon = platform === "kakao" ? (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3c-5.523 0-10 3.582-10 8 0 2.844 1.89 5.34 4.727 6.745-.18.654-.652 2.37-.747 2.738-.12.465.17.459.357.334.148-.099 2.354-1.6 3.31-2.249.441.065.894.1 1.353.1 5.523 0 10-3.582 10-8s-4.477-8-10-8z" />
    </svg>
  ) : platform === "naver" ? (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.273 12.845L7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845z" />
    </svg>
  ) : (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );

  return (
    <div className="w-full max-w-[480px] mx-auto fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        data-link-id="kakaotalk-chat"
        className={`absolute ${posClass} pointer-events-auto flex items-center gap-2 pl-4 pr-2 py-2 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform`}
        style={{ backgroundColor: colors.bg, color: colors.text, border: platform === "web" ? "1px solid #e5e7eb" : "none" }}
      >
        <span className="text-xs font-bold whitespace-nowrap">{text}</span>
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.iconBg }}>
          {icon}
        </div>
      </a>
    </div>
  );
}
