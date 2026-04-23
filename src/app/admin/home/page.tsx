"use client";

import PageSwitcher from "../edit/[slug]/page-switcher";
import AdminChannelBar from "../edit/[slug]/admin-channel-bar";
import AnalyticsTab from "../edit/[slug]/analytics-tab";

export default function HomeAnalyticsPage() {
  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col">
      <PageSwitcher currentSlug="home" currentProfile="" />
      <AdminChannelBar currentSlug="__home__" />

      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 z-10">
        <span className="text-xs text-gray-400">/home</span>
        <h1 className="text-sm font-bold text-gray-900">전체 채널 페이지 분석</h1>
        <a href="/home" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-700 font-medium">미리보기 &rarr;</a>
      </header>

      <div className="flex-1 bg-[#f5f6f8] overflow-y-scroll">
        <div className="max-w-3xl mx-auto">
          <AnalyticsTab slug="home" linkLabels={{}} linkUrls={{}} socialUrls={{}} />
        </div>
      </div>
    </div>
  );
}
