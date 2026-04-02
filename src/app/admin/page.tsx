"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();

  useEffect(() => {
    // 첫 번째 페이지가 있으면 바로 편집, 없으면 새 페이지 생성
    fetch("/api/pages")
      .then((r) => r.json())
      .then((pages) => {
        if (pages.length > 0) {
          router.replace(`/admin/edit/${pages[0].slug}`);
        } else {
          // 자동으로 첫 페이지 생성
          fetch("/api/pages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug: "mypage", title: "내 페이지" }),
          }).then(() => {
            router.replace("/admin/edit/mypage");
          });
        }
      });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
      <p className="text-sm text-gray-400">로딩 중...</p>
    </div>
  );
}
