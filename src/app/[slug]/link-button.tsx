"use client";

import Image from "next/image";
import { Link as LinkIcon } from "lucide-react";

export default function LinkButton({
  label,
  url,
  thumbnail,
  layout = "small",
  btnClassName = "",
}: {
  label: string;
  url: string;
  icon?: string;
  thumbnail?: string | null;
  layout?: string;
  btnClassName?: string;
}) {
  if (layout === "large") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className={`group w-full border border-gray-100 shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer overflow-hidden ${btnClassName}`}>
        {thumbnail && (
          <div className="w-full h-40 overflow-hidden">
            <Image src={thumbnail} alt={label} width={480} height={160} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="px-4 py-3">
          <span className="text-[15px] font-medium text-gray-800">{label}</span>
        </div>
      </a>
    );
  }

  if (layout === "medium") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className={`group flex items-center gap-4 w-full px-4 py-3 min-h-[96px] border border-gray-100 shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer ${btnClassName}`}>
        {thumbnail ? (
          <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
            <Image src={thumbnail} alt={label} width={80} height={80} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
            <LinkIcon className="w-7 h-7 text-gray-400" />
          </div>
        )}
        <span className="flex-1 text-[15px] font-medium text-gray-800 leading-snug">{label}</span>
      </a>
    );
  }

  // small (default)
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className={`group flex items-center gap-4 w-full px-4 py-3 min-h-[72px] border border-gray-100 shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer ${btnClassName}`}>
      {thumbnail ? (
        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
          <Image src={thumbnail} alt={label} width={56} height={56} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
          <LinkIcon className="w-6 h-6 text-gray-400" />
        </div>
      )}
      <span className="flex-1 text-[15px] font-medium text-gray-800 leading-snug">{label}</span>
    </a>
  );
}
