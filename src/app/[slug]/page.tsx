import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import LinkButton from "./link-button";
import SocialIcons from "./social-icons";
import DesignPreviewListener from "./design-preview";
import ChannelBar from "./channel-bar";
import ChatButton from "./chat-button";

export const revalidate = 60;

const FONT_MAP: Record<string, string> = {
  pretendard: "'Pretendard', -apple-system, sans-serif",
  "noto-sans": "'Noto Sans KR', sans-serif",
  gothic: "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
  "nanum-gothic": "'Nanum Gothic', sans-serif",
  "nanum-square": "'NanumSquare', sans-serif",
  gmarket: "'GmarketSans', sans-serif",
};

const SHAPE_MAP: Record<string, string> = {
  rounded: "16px",
  pill: "9999px",
  square: "4px",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { data: page } = await supabase
    .from("pages")
    .select("title, desc, profile")
    .eq("slug", slug)
    .single();

  if (!page) return { title: "페이지를 찾을 수 없습니다" };
  return {
    title: `${page.title} | Dazzle Links`,
    description: page.desc,
    openGraph: {
      title: page.title,
      description: page.desc,
      images: page.profile ? [page.profile] : [],
    },
  };
}

export default async function SlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: page } = await supabase
    .from("pages")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!page) {
    notFound();
  }

  const [linksRes, socialsRes] = await Promise.all([
    supabase.from("links").select("*").eq("page_id", page.id).order("sort_order"),
    supabase.from("socials").select("*").eq("page_id", page.id).order("sort_order"),
  ]);

  const allLinks = (linksRes.data || []).filter((l: { enabled?: boolean }) => l.enabled !== false);
  const links = allLinks.filter((l: { layout?: string }) => l.layout !== "kakaotalk");
  const socials = socialsRes.data || [];

  const bgColor = page.bg_color || "#f9fafb";
  const btnColor = page.btn_color || "#ffffff";
  const hoverColor = page.hover_color || "#e5e7eb";
  const btnShape = SHAPE_MAP[page.btn_shape] || "16px";
  const btnAction = page.btn_action || "fill";
  const fontFamily = FONT_MAP[page.font] || FONT_MAP.pretendard;

  // 호버 색상이 어두우면 글자를 흰색으로
  function isDark(hex: string) {
    const c = hex.replace("#", "");
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }
  const hoverTextColor = isDark(hoverColor) ? "#ffffff" : "#1f2937";

  return (
    <>
      <DesignPreviewListener />
      <style>{`
        body { background: ${bgColor}; font-family: ${fontFamily}; }
        .link-btn {
          background: ${btnColor};
          border-radius: ${btnShape};
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
          ${btnAction === "fill" ? "width: 300px; height: 300px; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0); border-radius: 50%;" : ""}
          ${btnAction === "wave" ? "inset: 0; transform: translateY(100%); border-radius: 50% 50% 0 0;" : ""}
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
          ${btnAction === "shadow" ? `box-shadow: 0 8px 30px ${hoverColor}50; background: ${hoverColor};` : ""}
        }
        .link-btn:hover * { color: ${hoverTextColor}; }
        .link-btn:active { transform: scale(0.98); }
      `}</style>
      {/* Channel Bar */}
      <ChannelBar currentSlug={slug} />

      {/* KakaoTalk Chat Button - from kakaotalk block or socials */}
      <ChatButton
        url={allLinks.find((l: { layout?: string }) => l.layout === "kakaotalk")?.url || socials.find((s: { platform: string }) => s.platform === "kakaotalk")?.url}
        label={allLinks.find((l: { layout?: string }) => l.layout === "kakaotalk")?.label}
      />

      <main className="w-full max-w-[480px] mx-auto px-5 pt-4 pb-10 flex flex-col items-center gap-8">
        {/* Profile */}
        <div className="flex flex-col items-center gap-3">
          {page.profile && (
            <div className="w-[100px] h-[100px] rounded-full overflow-hidden shadow-sm">
              <Image src={page.profile} alt={page.title} width={100} height={100} className="w-full h-full object-cover" />
            </div>
          )}
          <h1 className="text-lg font-bold text-gray-900">{page.title}</h1>
          {page.desc && (
            <p className="text-sm text-gray-500 text-center leading-relaxed">{page.desc}</p>
          )}
        </div>

        {/* SNS Icons */}
        {socials.length > 0 && <SocialIcons socials={socials} />}

        {/* Link Cards */}
        {links.length > 0 && (
          <div className="w-full flex flex-col gap-3">
            {links.map((link) => {
              if (link.layout === "spacer") {
                const h = parseInt(link.label) || 40;
                const ls = link.url || "none";
                return (
                  <div key={link.id} className="w-full flex items-center justify-center" style={{ height: `${h}px` }}>
                    {ls === "solid" && <div className="w-full border-t border-gray-200" />}
                    {ls === "dotted" && <div className="w-full border-t border-dashed border-gray-300" />}
                    {ls === "wave" && (
                      <svg className="w-full h-3 text-gray-200" viewBox="0 0 400 12" preserveAspectRatio="none">
                        <path d="M0,6 Q25,0 50,6 Q75,12 100,6 Q125,0 150,6 Q175,12 200,6 Q225,0 250,6 Q275,12 300,6 Q325,0 350,6 Q375,12 400,6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    )}
                    {ls === "zigzag" && (
                      <svg className="w-full h-3 text-gray-200" viewBox="0 0 400 12" preserveAspectRatio="none">
                        <path d="M0,6 L20,0 L40,12 L60,0 L80,12 L100,0 L120,12 L140,0 L160,12 L180,0 L200,12 L220,0 L240,12 L260,0 L280,12 L300,0 L320,12 L340,0 L360,12 L380,0 L400,12" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    )}
                  </div>
                );
              }
              if (link.layout === "text") {
                const opts = (() => { try { return JSON.parse(link.thumbnail || "{}"); } catch { return {}; } })();
                const align = opts.align || "center";
                const size = opts.size || "sm";
                const textLayout = opts.textLayout || "plain";
                const sizeClass = size === "lg" ? "text-lg" : size === "md" ? "text-base" : "text-sm";
                const alignClass = align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
                if (textLayout === "toggle") {
                  return (
                    <details key={link.id} className={`w-full ${alignClass}`}>
                      <summary className={`${sizeClass} font-semibold text-gray-800 cursor-pointer list-none flex items-center gap-2 ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : ""}`}>
                        {link.label}
                        <svg className="w-4 h-4 text-gray-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </summary>
                      <p className={`${size === "lg" ? "text-base" : size === "md" ? "text-sm" : "text-xs"} text-gray-500 mt-2 leading-relaxed whitespace-pre-wrap`}>{link.url}</p>
                    </details>
                  );
                }
                return (
                  <div key={link.id} className={`w-full ${alignClass}`}>
                    <p className={`${sizeClass} font-semibold text-gray-800`}>{link.label}</p>
                    {link.url && <p className={`${size === "lg" ? "text-base" : size === "md" ? "text-sm" : "text-xs"} text-gray-500 mt-1 leading-relaxed whitespace-pre-wrap`}>{link.url}</p>}
                  </div>
                );
              }
              return (
                <LinkButton
                  key={link.id}
                  label={link.label}
                  url={link.url}
                  thumbnail={link.thumbnail}
                  layout={link.layout}
                  btnClassName="link-btn"
                />
              );
            })}
          </div>
        )}

        {/* Footer */}
        <p className="mt-4 text-xs text-gray-300">Powered by Dazzle People</p>
      </main>
    </>
  );
}
