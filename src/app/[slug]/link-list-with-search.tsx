"use client";

import { useState, Children, isValidElement, cloneElement } from "react";
import SearchBlock from "./search-block";

export default function LinkListWithSearch({
  searchPlaceholder,
  children,
}: {
  searchPlaceholder?: string;
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState("");

  if (!searchPlaceholder && searchPlaceholder !== "") return <>{children}</>;

  const q = query.toLowerCase();

  // 검색어가 있으면 data-search-label에 검색어가 포함된 요소만 보여줌
  const filtered = q
    ? Children.toArray(children).filter((child) => {
        if (!isValidElement(child)) return false;
        const label = (child.props as Record<string, unknown>)?.["data-search-label"];
        if (typeof label === "string") return label.toLowerCase().includes(q);
        return true; // label 없는 요소는 항상 보여줌
      })
    : Children.toArray(children);

  return (
    <div className="w-full flex flex-col gap-2">
      <SearchBlock placeholder={searchPlaceholder || "검색"} onSearch={setQuery} />
      {filtered.length > 0 ? filtered : (
        q ? <p className="text-xs text-gray-400 text-center py-6">검색 결과가 없습니다</p> : null
      )}
    </div>
  );
}
