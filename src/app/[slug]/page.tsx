import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import LinkButton from "./link-button";
import SocialIcons from "./social-icons";

export const revalidate = 60; // ISR: 60초마다 갱신

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
    supabase
      .from("links")
      .select("*")
      .eq("page_id", page.id)
      .order("sort_order"),
    supabase
      .from("socials")
      .select("*")
      .eq("page_id", page.id)
      .order("sort_order"),
  ]);

  const links = (linksRes.data || []).filter((l: { enabled?: boolean }) => l.enabled !== false);
  const socials = socialsRes.data || [];

  return (
    <main className="w-full max-w-[480px] mx-auto px-5 pt-12 pb-10 flex flex-col items-center gap-8">
      {/* Profile */}
      <div className="flex flex-col items-center gap-3">
        {page.profile && (
          <div className="w-[100px] h-[100px] rounded-full overflow-hidden shadow-sm">
            <Image
              src={page.profile}
              alt={page.title}
              width={100}
              height={100}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <h1 className="text-lg font-bold text-gray-900">{page.title}</h1>
        {page.desc && (
          <p className="text-sm text-gray-500 text-center leading-relaxed">
            {page.desc}
          </p>
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
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <p className="mt-4 text-xs text-gray-300">Powered by Dazzle People</p>
    </main>
  );
}
