import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "다즐피플 전체 채널 | Dazzle Links",
  description: "다즐피플이 운영하는 모든 채널을 한눈에 확인하세요.",
};

export default async function ChannelsPage() {
  const { data: pages } = await supabase
    .from("pages")
    .select("*")
    .order("sort_order", { ascending: true });

  const channels = pages || [];

  return (
    <div className="min-h-screen bg-[#f9fafb]" style={{ fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
      <main className="w-full max-w-[480px] mx-auto px-5 pt-12 pb-10 flex flex-col items-center gap-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">다즐피플 채널</h1>
          <p className="text-sm text-gray-400">당신의 브랜드가 가장 빛나는 순간</p>
        </div>

        {/* Channel Grid */}
        <div className="w-full grid grid-cols-2 gap-3">
          {channels.map((ch) => (
            <Link
              key={ch.id}
              href={`/${ch.slug}`}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center gap-3 hover:shadow-md active:scale-[0.98] transition-all"
            >
              {ch.profile ? (
                <div className="w-16 h-16 rounded-full overflow-hidden shadow-sm">
                  <Image src={ch.profile} alt={ch.title} width={64} height={64} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-lg font-bold">
                  {ch.title[0]}
                </div>
              )}
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-900">{ch.title}</p>
                {ch.desc && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{ch.desc}</p>}
              </div>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <p className="mt-4 text-xs text-gray-300">Powered by Dazzle People</p>
      </main>
    </div>
  );
}
