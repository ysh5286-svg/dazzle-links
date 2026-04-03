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
      <div className="absolute inset-0 flex items-center justify-center">
        {/* YouTube Shorts style: red brush stroke + white play */}
        <div className="relative w-14 h-16 group-hover:scale-110 transition-transform drop-shadow-lg">
          <svg viewBox="0 0 56 64" className="w-full h-full">
            {/* Red brush stroke */}
            <path d="M28 2c8 0 18 2 22 8s6 14 4 22-6 16-12 22-10 8-14 8-8-2-14-8S4 40 2 32s0-16 4-22S20 2 28 2z" fill="#FF0000" />
            {/* White play triangle */}
            <path d="M23 20l16 12-16 12V20z" fill="white" />
          </svg>
        </div>
      </div>
    </button>
  );
}
