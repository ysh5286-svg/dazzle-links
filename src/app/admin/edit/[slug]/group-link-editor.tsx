"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import type { GroupLinkRow } from "@/lib/supabase";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// --- Add Link Modal ---
function AddLinkModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (data: { url: string; label: string; price: string; original_price: string; image: string }) => void;
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [image, setImage] = useState("");
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  const canSubmit = url && label && image;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-gray-900">링크 추가</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-red-400 mb-1 block">연결 URL *</label>
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="text-xs font-medium text-red-400 mb-1 block">대표문구 *</label>
              <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="버튼에 문구가 노출됩니다"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500 mb-1 block">판매가격</label>
                <div className="flex items-center">
                  <input type="text" value={price} onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-l-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  <span className="px-3 py-2.5 bg-gray-100 border border-l-0 border-gray-200 rounded-r-lg text-sm text-gray-500">원</span>
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500 mb-1 block">정가</label>
                <div className="flex items-center">
                  <input type="text" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-l-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  <span className="px-3 py-2.5 bg-gray-100 border border-l-0 border-gray-200 rounded-r-lg text-sm text-gray-500">원</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-red-400 mb-1 block">이미지 * (드래그앤드롭 또는 URL)</label>
              {image ? (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                  <img src={image} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setImage("")} className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 rounded-full text-white text-xs flex items-center justify-center">&times;</button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-400"}`}
                  onClick={() => document.getElementById("group-img-input")?.click()}
                >
                  <p className="text-xs text-gray-400">이미지를 드래그하거나 클릭해서 업로드</p>
                  <input id="group-img-input" type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                </div>
              )}
              <input type="text" value={image.startsWith("data:") ? "" : image} onChange={(e) => setImage(e.target.value)} placeholder="또는 이미지 URL 입력"
                className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={() => { if (canSubmit) onAdd({ url, label, price, original_price: originalPrice, image }); }} disabled={!canSubmit}
              className="flex-1 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50">생성</button>
          </div>
        </div>
      </div>
    </>
  );
}

// --- Sortable Group Link Item ---
function SortableGroupItem({ item, onToggle, onDelete }: {
  item: GroupLinkRow;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl p-2.5">
      {/* Drag */}
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-gray-300 hover:text-gray-500 px-0.5">
        <svg className="w-3.5 h-4" viewBox="0 0 16 20" fill="currentColor">
          <circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="4" r="1.5" />
          <circle cx="5" cy="10" r="1.5" /><circle cx="11" cy="10" r="1.5" />
          <circle cx="5" cy="16" r="1.5" /><circle cx="11" cy="16" r="1.5" />
        </svg>
      </div>

      {/* Image */}
      {item.image && (
        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
          <img src={item.image} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${item.enabled ? "text-gray-800" : "text-gray-300"}`}>{item.label}</p>
        {item.price && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs font-bold text-gray-900">{item.price}원</span>
            {item.original_price && <span className="text-[10px] text-gray-400 line-through">{item.original_price}원</span>}
          </div>
        )}
        <p className="text-[10px] text-gray-400 truncate">{item.url}</p>
        {/* ON/OFF */}
        <button onClick={onToggle} className={`mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${item.enabled ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
          {item.enabled ? "ON" : "OFF"}
        </button>
      </div>

      {/* Delete */}
      <button onClick={onDelete} className="text-gray-300 hover:text-red-500 shrink-0 p-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

// --- Main Editor ---
export default function GroupLinkEditor({ linkId, onRefresh }: { linkId: string; onRefresh: () => void }) {
  const [items, setItems] = useState<GroupLinkRow[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const fetchItems = useCallback(async () => {
    const res = await fetch(`/api/group-links?link_id=${linkId}`);
    if (res.ok) setItems(await res.json());
  }, [linkId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function addItem(data: { url: string; label: string; price: string; original_price: string; image: string }) {
    await fetch("/api/group-links", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, link_id: linkId, sort_order: items.length }),
    });
    setShowAdd(false);
    await fetchItems();
    onRefresh();
  }

  async function toggleItem(id: string, enabled: boolean) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, enabled } : i));
    await fetch("/api/group-links", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, enabled }) });
    onRefresh();
  }

  async function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch("/api/group-links", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    onRefresh();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIdx, newIdx);
    setItems(reordered);
    await Promise.all(reordered.map((item, i) =>
      fetch("/api/group-links", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, sort_order: i }) })
    ));
    onRefresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-red-400">링크 목록 *</p>

      {/* + 링크 추가 */}
      <button onClick={() => setShowAdd(true)} className="w-full py-2 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800">
        + 링크 추가
      </button>

      {showAdd && <AddLinkModal onClose={() => setShowAdd(false)} onAdd={addItem} />}

      {/* Items */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableGroupItem
              key={item.id}
              item={item}
              onToggle={() => toggleItem(item.id, !item.enabled)}
              onDelete={() => deleteItem(item.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {items.length === 0 && (
        <p className="text-xs text-gray-300 text-center py-4">등록된 링크가 없습니다</p>
      )}
    </div>
  );
}
