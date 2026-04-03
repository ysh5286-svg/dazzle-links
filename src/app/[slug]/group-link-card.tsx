"use client";

import Image from "next/image";

type GroupItem = {
  id: string;
  label: string;
  url: string;
  image: string | null;
  price: string | null;
  original_price: string | null;
  enabled: boolean;
};

export default function GroupLinkCard({
  label,
  items,
  btnClassName,
}: {
  label: string;
  items: GroupItem[];
  btnClassName?: string;
}) {
  const activeItems = items.filter((i) => i.enabled);
  if (activeItems.length === 0) return null;

  return (
    <div className="w-full">
      {label && <p className="text-sm font-semibold text-gray-700 mb-2 px-1">{label}</p>}
      <div className="grid grid-cols-3 gap-2">
        {activeItems.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex flex-col bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md active:scale-[0.98] transition-all ${btnClassName || ""}`}
          >
            {item.image && (
              <div className="aspect-square overflow-hidden">
                <Image src={item.image} alt={item.label} width={200} height={200} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-2">
              <p className="text-[11px] font-medium text-gray-800 line-clamp-2 leading-tight">{item.label}</p>
              {item.price && (
                <div className="mt-1">
                  <span className="text-xs font-bold text-gray-900">{item.price}원</span>
                  {item.original_price && (
                    <span className="text-[10px] text-gray-400 line-through ml-1">{item.original_price}원</span>
                  )}
                </div>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
