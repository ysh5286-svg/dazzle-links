"use client";

import Image from "next/image";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

function getIcon(name: string): LucideIcon {
  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  return icons[name] || LucideIcons.Link;
}

export default function LinkButton({
  label,
  url,
  icon,
  thumbnail,
}: {
  label: string;
  url: string;
  icon: string;
  thumbnail?: string;
}) {
  const Icon = getIcon(icon);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-4 w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-150 cursor-pointer"
    >
      {/* Thumbnail or Icon */}
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-50">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={label}
            width={56}
            height={56}
            className="w-full h-full object-cover"
          />
        ) : (
          <Icon className="w-6 h-6 text-gray-500" />
        )}
      </div>

      {/* Label */}
      <span className="flex-1 text-[15px] font-medium text-gray-800 leading-snug">
        {label}
      </span>
    </a>
  );
}
