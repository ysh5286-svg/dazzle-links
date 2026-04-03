"use client";

import { useEffect, useState } from "react";

type AnalyticsData = {
  daily: { date: string; views: number; clicks: number }[];
  totalViews: number;
  totalClicks: number;
  clickRate: number;
  referers: { name: string; count: number }[];
  linkClicks: { link_id: string; count: number }[];
};

const PERIODS = [
  { key: "all", label: "전체기간" },
  { key: "7d", label: "일주일" },
  { key: "1m", label: "1개월" },
  { key: "3m", label: "3개월" },
  { key: "6m", label: "6개월" },
];

const COLORS = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#60a5fa", "#a78bfa"];

export default function AnalyticsTab({ slug, linkLabels }: { slug: string; linkLabels: Record<string, string> }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState("7d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?slug=${slug}&period=${period}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug, period]);

  if (loading || !data) {
    return (
      <div className="p-6 flex flex-col gap-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  const maxY = Math.max(...data.daily.map((d) => Math.max(d.views, d.clicks)), 1);
  const totalReferers = data.referers.reduce((s, r) => s + r.count, 0);

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">분석</h2>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
          {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>

      {/* Line Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-4 mb-3">
          <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-0.5 bg-blue-500 rounded" />클릭수</span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-0.5 bg-red-400 rounded" />조회수</span>
        </div>
        {data.daily.length > 0 ? (
          <div className="relative h-40">
            {/* Y axis labels */}
            <div className="absolute left-0 top-0 bottom-4 w-8 flex flex-col justify-between text-[10px] text-gray-400">
              <span>{maxY}</span>
              <span>{Math.round(maxY / 2)}</span>
              <span>0</span>
            </div>
            {/* Chart area */}
            <svg className="ml-8 w-[calc(100%-32px)] h-36" viewBox={`0 0 ${data.daily.length * 60} 140`} preserveAspectRatio="none">
              {/* Views line (red) */}
              <polyline
                fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                points={data.daily.map((d, i) => `${i * 60 + 30},${140 - (d.views / maxY) * 130}`).join(" ")}
              />
              {/* Clicks line (blue) */}
              <polyline
                fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                points={data.daily.map((d, i) => `${i * 60 + 30},${140 - (d.clicks / maxY) * 130}`).join(" ")}
              />
              {/* Dots */}
              {data.daily.map((d, i) => (
                <g key={i}>
                  <circle cx={i * 60 + 30} cy={140 - (d.views / maxY) * 130} r="3" fill="#f87171" />
                  <circle cx={i * 60 + 30} cy={140 - (d.clicks / maxY) * 130} r="3" fill="#3b82f6" />
                </g>
              ))}
            </svg>
            {/* X axis labels */}
            <div className="ml-8 flex justify-between text-[9px] text-gray-400 mt-1" style={{ width: "calc(100% - 32px)" }}>
              {data.daily.filter((_, i) => i % Math.max(1, Math.floor(data.daily.length / 5)) === 0).map((d) => (
                <span key={d.date}>{d.date.substring(5)}</span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-300 text-center py-8">데이터가 없습니다</p>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-500 mb-1">조회수</p>
          <p className="text-lg font-bold text-gray-900">{data.totalViews}<span className="text-xs font-normal text-gray-500">회</span></p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-500 mb-1">클릭 수</p>
          <p className="text-lg font-bold text-gray-900">{data.totalClicks}<span className="text-xs font-normal text-gray-500">회</span></p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-500 mb-1">클릭율</p>
          <p className="text-lg font-bold text-gray-900">{data.clickRate}<span className="text-xs font-normal text-gray-500">%</span></p>
        </div>
      </div>

      {/* Referer Donut Chart */}
      {data.referers.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">유입 채널</h3>
          <div className="flex items-center gap-6">
            {/* Donut */}
            <div className="relative w-28 h-28 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {(() => {
                  let offset = 0;
                  return data.referers.map((r, i) => {
                    const pct = (r.count / totalReferers) * 100;
                    const dash = `${pct * 2.51} ${251 - pct * 2.51}`;
                    const el = (
                      <circle key={i} cx="50" cy="50" r="40" fill="none" stroke={COLORS[i % COLORS.length]}
                        strokeWidth="18" strokeDasharray={dash} strokeDashoffset={-offset * 2.51} />
                    );
                    offset += pct;
                    return el;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-gray-600">{totalReferers}</span>
              </div>
            </div>
            {/* Legend */}
            <div className="flex flex-col gap-1.5">
              {data.referers.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-xs text-gray-600">{r.count}</span>
                  <span className="text-xs text-blue-500">{r.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Link Clicks */}
      {data.linkClicks.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">블럭별 클릭수</h3>
          <div className="flex flex-col gap-2">
            {data.linkClicks.map((lc, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="text-xs text-gray-600 truncate">{linkLabels[lc.link_id] || lc.link_id.substring(0, 8)}</span>
                <span className="text-xs font-bold text-gray-900 shrink-0 ml-2">{lc.count}회</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
