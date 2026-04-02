import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import LinkButton from "./link-button";
import SocialIcons from "./social-icons";

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

  const links = (linksRes.data || []).filter((l: { enabled?: boolean }) => l.enabled !== false);
  const socials = socialsRes.data || [];

  const bgColor = page.bg_color || "#f9fafb";
  const btnColor = page.btn_color || "#ffffff";
  const hoverColor = page.hover_color || "#e5e7eb";
  const btnShape = SHAPE_MAP[page.btn_shape] || "16px";
  const btnAction = page.btn_action || "fill";
  const fontFamily = FONT_MAP[page.font] || FONT_MAP.pretendard;

  return (
    <>
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
          inset: 0;
          z-index: -1;
          transition: transform 0.4s ease, opacity 0.4s ease;
          opacity: 0;
          background: ${hoverColor};
          ${btnAction === "fill" ? "border-radius: 50%; transform: scale(0);" : ""}
          ${btnAction === "wave" ? "transform: translateY(100%);" : ""}
          ${btnAction === "shadow" ? "box-shadow: 0 8px 30px " + hoverColor + "50;" : ""}
        }
        .link-btn:hover::before {
          opacity: 1;
          ${btnAction === "fill" ? "transform: scale(2.5); border-radius: 0;" : ""}
          ${btnAction === "wave" ? "transform: translateY(0);" : ""}
        }
        .link-btn:hover {
          transform: scale(1.02);
          ${btnAction === "shadow" ? `box-shadow: 0 8px 30px ${hoverColor}50;` : ""}
        }
        .link-btn:active { transform: scale(0.98); }
        ${btnAction === "wave" ? `
        .link-btn::before {
          background: ${hoverColor};
          border-radius: 50% 50% 0 0;
          transform: translateY(100%);
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
        }
        .link-btn:hover::before {
          border-radius: 0;
          transform: translateY(0);
        }` : ""}
      `}</style>
      <main className="w-full max-w-[480px] mx-auto px-5 pt-12 pb-10 flex flex-col items-center gap-8">
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
            {links.map((link) => (
              <LinkButton
                key={link.id}
                label={link.label}
                url={link.url}
                thumbnail={link.thumbnail}
                layout={link.layout}
                btnClassName="link-btn"
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <p className="mt-4 text-xs text-gray-300">Powered by Dazzle People</p>
      </main>
    </>
  );
}
