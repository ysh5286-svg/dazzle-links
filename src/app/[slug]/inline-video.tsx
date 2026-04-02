"use client";

import { useState } from "react";

export default function InlineVideo({ vid }: { vid: string }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="relative rounded-xl overflow-hidden aspect-[9/16] bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${vid}?autoplay=1&playsinline=1`}
          allow="autoplay; encrypted-media"
          allowFullScreen
          className="w-full h-full border-0"
        />
      </div>
    );
  }

  return (
    <button onClick={() => setPlaying(true)} className="relative block w-full rounded-xl overflow-hidden aspect-[9/16] group">
      <img src={`https://img.youtube.com/vi/${vid}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <svg className="w-14 h-14 drop-shadow-lg" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="white" fillOpacity="0.9" />
          <path d="M20 16l12 8-12 8V16z" fill="#333" />
        </svg>
      </div>
    </button>
  );
}
