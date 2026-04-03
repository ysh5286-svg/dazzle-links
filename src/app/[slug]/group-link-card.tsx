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

function PriceTag({ price, originalPrice }: { price: string | null; originalPrice: string | null }) {
  if (!price) return null;
  const p = parseInt(price.replace(/,/g, "")) || 0;
  const op = parseInt((originalPrice || "").replace(/,/g, "")) || 0;
  const discount = op > 0 && p < op ? Math.round((1 - p / op) * 100) : 0;
  return (
    <div className="mt-1 flex items-center gap-1 flex-wrap">
      {discount > 0 && <span className="text-[10px] font-bold text-red-500">{discount}%</span>}
      <span className="text-xs font-bold text-gray-900">{Number(price.replace(/,/g, "")).toLocaleString()}원</span>
      {originalPrice && op > p && <span className="text-[10px] text-gray-400 line-through">{Number(originalPrice.replace(/,/g, "")).toLocaleString()}원</span>}
    </div>
  );
}

function ItemCard({ item }: { item: GroupItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md active:scale-[0.98] transition-all shrink-0"
    >
      {item.image && (
        <div className="aspect-square overflow-hidden rounded-t-xl">
          <Image src={item.image} alt={item.label} width={200} height={200} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-2 text-center">
        <p className="text-[11px] font-medium text-gray-800 line-clamp-2 leading-tight">{item.label}</p>
        <PriceTag price={item.price} originalPrice={item.original_price} />
      </div>
    </a>
  );
}

function Carousel({ items, columns }: { items: GroupItem[]; columns: number }) {
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
          <ItemCard item={item} />
        </div>
      ))}
    </div>
  );
}

export default function GroupLinkCard({
  label,
  items,
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
    <div className="w-full bg-gray-50 rounded-2xl p-4">
      {/* 대표문구 - 중앙정렬 */}
      {label && label !== "그룹 링크" && (
        <p className="text-sm font-bold text-gray-800 text-center mb-3">{label}</p>
      )}

      {/* 레이아웃별 렌더링 */}
      {layout === "carousel1" ? (
        <Carousel items={displayItems} columns={1} />
      ) : layout === "carousel2" ? (
        <Carousel items={displayItems} columns={2} />
      ) : layout === "list" ? (
        <div className="flex flex-col gap-2">
          {displayItems.map((item) => (
            <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
              {item.image && (
                <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0">
                  <Image src={item.image} alt={item.label} width={56} height={56} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.label}</p>
                <PriceTag price={item.price} originalPrice={item.original_price} />
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className={`grid ${gridClass} gap-2`}>
          {displayItems.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* 더보기 */}
      {listMode === "fold" && activeItems.length > displayItems.length && !expanded && (
        <button onClick={() => setExpanded(true)} className="w-full mt-3 py-2 text-xs text-gray-500 hover:text-gray-700 bg-white rounded-xl shadow-sm">
          더보기 ∨
        </button>
      )}
    </div>
  );
}
