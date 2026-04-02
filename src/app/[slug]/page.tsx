import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import linksData from "@/data/links.json";
import LinkButton from "./link-button";
import SocialIcons from "./social-icons";

type PageData = {
  title: string;
  desc: string;
  profile: string;
  links: { label: string; url: string; icon: string; thumbnail?: string }[];
  socials?: { platform: string; url: string }[];
};

const data = linksData as Record<string, PageData>;

export async function generateStaticParams() {
  return Object.keys(data).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = data[slug];
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
  const page = data[slug];

  if (!page) {
    notFound();
  }

  return (
    <main className="w-full max-w-[480px] mx-auto px-5 pt-12 pb-10 flex flex-col items-center gap-8">
      {/* Profile */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-[100px] h-[100px] rounded-full overflow-hidden shadow-sm">
          <Image
            src={page.profile}
            alt={page.title}
            width={100}
            height={100}
            className="w-full h-full object-cover"
          />
        </div>
        <h1 className="text-lg font-bold text-gray-900">{page.title}</h1>
        <p className="text-sm text-gray-500 text-center leading-relaxed">
          {page.desc}
        </p>
      </div>

      {/* SNS Icons - right below profile */}
      {page.socials && page.socials.length > 0 && (
        <SocialIcons socials={page.socials} />
      )}

      {/* Link Cards */}
      <div className="w-full flex flex-col gap-3">
        {page.links.map((link, i) => (
          <LinkButton
            key={i}
            label={link.label}
            url={link.url}
            icon={link.icon}
            thumbnail={link.thumbnail}
          />
        ))}
      </div>

      {/* Footer */}
      <p className="mt-4 text-xs text-gray-300">
        Powered by Dazzle People
      </p>
    </main>
  );
}
