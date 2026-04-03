"use client";

import Image from "next/image";
import { useRef, useState } from "react";

type GroupItem = {
  id: string;
  label: string;
  url: string;
  image: string | null;
  price: string | null;
  original_price: string | null;
  enabled: boolean;
};

function ItemCard({ item, btnClassName }: { item: GroupItem; btnClassName?: string }) {
  return (
    <a
      key={item.id}
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex flex-col bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md active:scale-[0.98] transition-all shrink-0 ${btnClassName || ""}`}
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
  );
}

function Carousel({ items, columns, btnClassName }: { items: GroupItem[]; columns: number; btnClassName?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto cursor-grab"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
      onMouseDown={(e) => { if (!scrollRef.current) return; setIsDragging(true); startX.current = e.pageX - scrollRef.current.offsetLeft; scrollLeft.current = scrollRef.current.scrollLeft; scrollRef.current.style.cursor = "grabbing"; }}
      onMouseLeave={() => { setIsDragging(false); if (scrollRef.current) scrollRef.current.style.cursor = "grab"; }}
      onMouseUp={() => { setIsDragging(false); if (scrollRef.current) scrollRef.current.style.cursor = "grab"; }}
      onMouseMove={(e) => { if (!isDragging || !scrollRef.current) return; e.preventDefault(); scrollRef.current.scrollLeft = scrollLeft.current - (e.pageX - scrollRef.current.offsetLeft - startX.current); }}
    >
      {items.map((item) => (
        <div key={item.id} style={{ width: `${100 / columns - 2}%`, minWidth: `${100 / columns - 2}%` }}>
          <ItemCard item={item} btnClassName={btnClassName} />
        </div>
      ))}
    </div>
  );
}

export default function GroupLinkCard({
  label,
  items,
  btnClassName,
  layoutConfig,
}: {
  label: string;
  items: GroupItem[];
  btnClassName?: string;
  layoutConfig?: string;
}) {
  const activeItems = items.filter((i) => i.enabled);
  if (activeItems.length === 0) return null;

  const config = (() => { try { return JSON.parse(layoutConfig || "{}"); } catch { return {}; } })();
  const layout = config.layout || "grid3";
  const listMode = config.listMode || "all";
  const [expanded, setExpanded] = useState(listMode === "all");
  const displayItems = expanded || listMode === "all" ? activeItems : activeItems.slice(0, layout === "grid3" ? 6 : layout === "grid2" ? 4 : 3);

  const gridClass = layout === "grid2" ? "grid-cols-2" : layout === "grid3" ? "grid-cols-3" : "grid-cols-1";

  return (
    <div className="w-full">
      {label && label !== "그룹 링크" && <p className="text-sm font-semibold text-gray-700 mb-2 px-1">{label}</p>}

      {layout === "carousel1" ? (
        <Carousel items={displayItems} columns={1} btnClassName={btnClassName} />
      ) : layout === "carousel2" ? (
        <Carousel items={displayItems} columns={2} btnClassName={btnClassName} />
      ) : layout === "list" ? (
        <div className="flex flex-col gap-2">
          {displayItems.map((item) => (
            <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all ${btnClassName || ""}`}>
              {item.image && (
                <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0">
                  <Image src={item.image} alt={item.label} width={56} height={56} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.label}</p>
                {item.price && (
                  <div className="mt-0.5">
                    <span className="text-xs font-bold text-gray-900">{item.price}원</span>
                    {item.original_price && <span className="text-[10px] text-gray-400 line-through ml-1">{item.original_price}원</span>}
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className={`grid ${gridClass} gap-2`}>
          {displayItems.map((item) => (
            <ItemCard key={item.id} item={item} btnClassName={btnClassName} />
          ))}
        </div>
      )}

      {listMode === "fold" && activeItems.length > displayItems.length && !expanded && (
        <button onClick={() => setExpanded(true)} className="w-full mt-2 py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl">
          더보기 ({activeItems.length - displayItems.length}개)
        </button>
      )}
    </div>
  );
}
