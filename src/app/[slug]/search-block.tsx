"use client";

import { useState } from "react";

export default function SearchBlock({
  placeholder,
  onSearch,
}: {
  placeholder: string;
  onSearch: (query: string) => void;
}) {
  const [query, setQuery] = useState("");

  function handleChange(val: string) {
    setQuery(val);
    onSearch(val);
  }

  return (
    <div className="w-full">
      <div className="flex items-center bg-gray-100 rounded-full px-4 py-3 gap-3">
        <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder || "검색"}
          className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
        />
        {query && (
          <button onClick={() => handleChange("")} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
