"use client";

import { useEffect, useState } from "react";

type AnalyticsData = {
  daily: { date: string; views: number; clicks: number }[];
  totalViews: number;
  totalClicks: number;
  clickRate: number;
  referers: { name: string; count: number }[];
  internals: { name: string; count: number }[];
  countries: { name: string; count: number }[];
  linkClicks: { link_id: string; count: number; daily: { date: string; clicks: number }[] }[];
};

const PERIODS = [
  { key: "all", label: "전체기간" },
  { key: "7d", label: "일주일" },
  { key: "1m", label: "1개월" },
  { key: "3m", label: "3개월" },
  { key: "6m", label: "6개월" },
];

const COLORS = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#60a5fa", "#a78bfa"];

function LinkClickAccordion({ lc, label, url }: { lc: { link_id: string; count: number; daily: { date: string; clicks: number }[] }; label: string; url?: string }) {
  const [open, setOpen] = useState(false);
  const maxClicks = Math.max(...lc.daily.map((d) => d.clicks), 1);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-green-100 flex items-center justify-center text-green-600 text-[10px] font-bold">L</span>
          <span className="text-sm font-semibold text-gray-800">단일 링크</span>
          <span className="text-sm text-gray-500 truncate max-w-[120px]">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-blue-500">{lc.count}회</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && lc.daily.length > 0 && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3">
          {/* Mini line chart */}
          <div className="relative h-24">
            <div className="absolute left-0 top-0 bottom-4 w-6 flex flex-col justify-between text-[9px] text-gray-400">
              <span>{maxClicks}</span>
              <span>0</span>
            </div>
            <svg className="ml-6 w-[calc(100%-24px)] h-20" viewBox={`0 0 ${Math.max(lc.daily.length * 50, 100)} 80`} preserveAspectRatio="none">
              <polyline
                fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                points={lc.daily.map((d, i) => `${i * 50 + 25},${80 - (d.clicks / maxClicks) * 70}`).join(" ")}
              />
              {lc.daily.map((d, i) => (
                <circle key={i} cx={i * 50 + 25} cy={80 - (d.clicks / maxClicks) * 70} r="3" fill="#3b82f6" />
              ))}
            </svg>
            <div className="ml-6 flex justify-between text-[8px] text-gray-400 mt-0.5" style={{ width: "calc(100% - 24px)" }}>
              {lc.daily.filter((_, i) => i % Math.max(1, Math.floor(lc.daily.length / 4)) === 0).map((d) => (
                <span key={d.date}>{d.date.substring(5)}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-xs font-semibold text-gray-800">{label}</p>
              {url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline truncate block max-w-[250px]">{url}</a>}
            </div>
            <span className="text-xs font-bold text-blue-500 shrink-0">클릭 {lc.count}회</span>
          </div>
        </div>
      )}
      {open && lc.daily.length === 0 && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3">
          <p className="text-xs text-gray-300 text-center">클릭 데이터가 없습니다</p>
        </div>
      )}
    </div>
  );
}

function SnsClickAccordion({ snsClicks, totalClicks, daily, socialUrls }: {
  snsClicks: { link_id: string; count: number; daily: { date: string; clicks: number }[] }[];
  totalClicks: number;
  daily: { date: string; clicks: number }[];
  socialUrls: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const maxY = Math.max(...daily.map((d) => d.clicks), 1);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center text-white text-[10px] font-bold">S</span>
          <span className="text-sm font-semibold text-gray-800">SNS 연결</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-blue-500">{totalClicks}회</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3">
          {/* Mini chart */}
          {daily.length > 0 && (
            <div className="relative h-20 mb-3">
              <div className="absolute left-0 top-0 bottom-4 w-6 flex flex-col justify-between text-[9px] text-gray-400">
                <span>{maxY}</span>
                <span>0</span>
              </div>
              <svg className="ml-6 w-[calc(100%-24px)] h-16" viewBox={`0 0 ${Math.max(daily.length * 50, 100)} 64`} preserveAspectRatio="none">
                <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  points={daily.map((d, i) => `${i * 50 + 25},${64 - (d.clicks / maxY) * 56}`).join(" ")} />
                {daily.map((d, i) => <circle key={i} cx={i * 50 + 25} cy={64 - (d.clicks / maxY) * 56} r="3" fill="#3b82f6" />)}
              </svg>
              <div className="ml-6 flex justify-between text-[8px] text-gray-400 mt-0.5" style={{ width: "calc(100% - 24px)" }}>
                {daily.filter((_, i) => i % Math.max(1, Math.floor(daily.length / 4)) === 0).map((d) => (
                  <span key={d.date}>{d.date.substring(5)}</span>
                ))}
              </div>
            </div>
          )}
          {/* Per-platform breakdown - show all platforms, even 0 clicks */}
          <div className="flex flex-col gap-2">
            {Object.entries(socialUrls).map(([platform, url]) => {
              const clickData = snsClicks.find((sc) => sc.link_id === `sns:${platform}`);
              const count = clickData?.count || 0;
              const label = PLATFORM_LABELS[`sns:${platform}`] || platform;
              return (
                <div key={platform} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{label}</p>
                    {url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline truncate block max-w-[200px]">{url}</a>}
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${count > 0 ? "text-blue-500" : "text-gray-300"}`}>클릭 {count}회</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const PLATFORM_LABELS: Record<string, string> = {
  "sns:instagram": "인스타그램", "sns:facebook": "페이스북", "sns:tiktok": "틱톡",
  "sns:youtube": "유튜브", "sns:naver": "네이버", "sns:kakaotalk": "카카오톡",
};

export default function AnalyticsTab({ slug, linkLabels, linkUrls, socialUrls }: { slug: string; linkLabels: Record<string, string>; linkUrls?: Record<string, string>; socialUrls?: Record<string, string> }) {
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

      {/* Summary Cards - Dark style */}
      <div className="grid grid-cols-3 gap-0 bg-gray-900 rounded-2xl overflow-hidden">
        <div className="p-3 text-center border-r border-gray-700">
          <div className="flex items-center justify-center gap-1 mb-1">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            <span className="text-[10px] text-gray-400">조회수</span>
          </div>
          <p className="text-lg font-bold text-white">{data.totalViews}<span className="text-xs font-normal text-gray-400">회</span></p>
        </div>
        <div className="p-3 text-center border-r border-gray-700">
          <div className="flex items-center justify-center gap-1 mb-1">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>
            <span className="text-[10px] text-gray-400">클릭 수</span>
          </div>
          <p className="text-lg font-bold text-white">{data.totalClicks}<span className="text-xs font-normal text-gray-400">회</span></p>
        </div>
        <div className="p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <span className="text-[10px] text-gray-400">클릭율</span>
          </div>
          <p className="text-lg font-bold text-white">{data.clickRate}<span className="text-xs font-normal text-gray-400">%</span></p>
        </div>
      </div>

      {/* Referer Donut Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">유입 채널</h3>
        {data.referers.length > 0 ? (
          <div className="flex items-center gap-6">
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
            <div className="flex flex-col gap-1.5">
              {data.referers.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-xs text-gray-600">{r.count}</span>
                  <a href={`https://${r.name}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">{r.name}</a>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-300 text-center py-3">기록이 없습니다</p>
        )}
      </div>

      {/* Internal Navigation */}
      {data.internals && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">내부 이동 (다른 채널에서 유입)</h3>
          {data.internals.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {data.internals.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-blue-500">/{item.name}</span>
                  <span className="text-xs font-bold text-gray-600">{item.count}회</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-300 text-center py-3">기록이 없습니다</p>
          )}
        </div>
      )}

      {/* Country Donut Chart */}
      {(() => {
        const countries = data.countries || [];
        const totalCountries = countries.reduce((s, c) => s + c.count, 0);
        return (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800">유입 국가</h3>
              <span className="text-[10px] text-gray-400">TOP5</span>
            </div>
            {countries.length > 0 ? (
              <div className="flex items-center gap-6">
                <div className="relative w-28 h-28 shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {(() => {
                      let offset = 0;
                      return countries.map((c, i) => {
                        const pct = (c.count / totalCountries) * 100;
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
                    <span className="text-[10px] font-bold text-gray-500">{totalCountries > 0 ? Math.round((countries[0]?.count || 0) / totalCountries * 100) : 0}%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {countries.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-gray-600">{c.count}</span>
                      <span className="text-xs text-gray-800">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-300 text-center py-3">기록이 없습니다</p>
            )}
          </div>
        );
      })()}

      {/* SNS Clicks */}
      {(() => {
        const snsClicks = data.linkClicks.filter((lc) => lc.link_id.startsWith("sns:"));
        const totalSnsClicks = snsClicks.reduce((s, lc) => s + lc.count, 0);
        const snsDailyAll: Record<string, number> = {};
        snsClicks.forEach((lc) => lc.daily.forEach((d) => { snsDailyAll[d.date] = (snsDailyAll[d.date] || 0) + d.clicks; }));
        const snsDailySorted = Object.entries(snsDailyAll).sort(([a], [b]) => a.localeCompare(b)).map(([date, clicks]) => ({ date, clicks }));

        if (Object.keys(socialUrls || {}).length === 0) return null;
        return (
          <SnsClickAccordion
            snsClicks={snsClicks}
            totalClicks={totalSnsClicks}
            daily={snsDailySorted}
            socialUrls={socialUrls || {}}
          />
        );
      })()}

      {/* Link Clicks - All blocks shown (even 0 clicks) */}
      {Object.keys(linkLabels).length > 0 && (
        <div className="flex flex-col gap-2">
          {Object.entries(linkLabels).map(([linkId, label]) => {
            const lc = data.linkClicks.find((c) => c.link_id === linkId) || { link_id: linkId, count: 0, daily: [] };
            return (
              <LinkClickAccordion key={linkId} lc={lc} label={label} url={linkUrls?.[linkId]} />
            );
          })}
        </div>
      )}
    </div>
  );
}
