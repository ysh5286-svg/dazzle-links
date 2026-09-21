"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/admin-api";

export default function AdminDashboard() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    // 첫 번째 페이지가 있으면 바로 편집, 없으면 새 페이지 생성
    fetch("/api/pages")
      .then((r) => r.json())
      .then((pages) => {
        if (pages.length > 0) {
          router.replace(`/admin/edit/${pages[0].slug}`);
        } else {
          // 자동으로 첫 페이지 생성
          apiJson("/api/pages", "POST", { slug: "mypage", title: "내 페이지" }).then((r) => {
            if (!r.ok) { setError(`첫 페이지 생성 실패 — ${r.error}`); return; }
            router.replace("/admin/edit/mypage");
          });
        }
      });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
      {error ? <p role="alert" className="text-sm text-red-500">{error}</p> : <p className="text-sm text-gray-400">로딩 중...</p>}
    </div>
  );
}
