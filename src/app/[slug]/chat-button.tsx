"use client";

export default function ChatButton({ url }: { url?: string }) {
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#FFE812] rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
    >
      <svg className="w-8 h-8 text-[#3C1E1E]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3c-5.523 0-10 3.582-10 8 0 2.844 1.89 5.34 4.727 6.745-.18.654-.652 2.37-.747 2.738-.12.465.17.459.357.334.148-.099 2.354-1.6 3.31-2.249.441.065.894.1 1.353.1 5.523 0 10-3.582 10-8s-4.477-8-10-8z" />
      </svg>
    </a>
  );
}
