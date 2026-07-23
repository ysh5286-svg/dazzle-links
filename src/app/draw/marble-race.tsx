"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Matter from "matter-js";

// ── 월드 좌표 (물리 시뮬레이션 기준 크기) ─────────────────────────
const WORLD_W = 480;
const WORLD_H = 4200;
const GATE_Y = 240;
const FINISH_Y = 3940;
const MAX_PARTICIPANTS = 400;

const NAVY = "#1d3b8b";
const YELLOW = "#f5c518";
const GREEN = "#5bab3a";

const MARBLE_COLORS = [
  "#1d3b8b", "#f5c518", "#5bab3a", "#3b5bd6",
  "#d9a400", "#4a9030", "#64748b", "#16295f",
];

// 인스타 댓글 복사 시 섞여 들어오는 잡음 줄
const NOISE_RE = [
  /프로필\s*사진/, /^답글/, /답글\s*달기/, /좋아요\s*\d*\s*개?$/, /번역\s*보기/,
  /인증됨/, /^팔로우$/, /^더\s*보기$/, /^·+$/,
  /^\d+\s*(초|분|시간|일|주|개월|년)(\s*전)?$/,
];

const HANDLE_RE = /^[A-Za-z0-9._]{2,30}$/;

function parseParticipants(raw: string, dedupe: boolean, excludeRaw: string): string[] {
  const excludes = new Set(
    excludeRaw
      .split(/[,\s]+/)
      .map((e) => e.replace(/^@/, "").trim().toLowerCase())
      .filter(Boolean)
  );
  const out: string[] = [];
  const seen = new Set<string>();
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (NOISE_RE.some((re) => re.test(line))) continue;

    let name: string | null = null;
    const at = line.match(/@([A-Za-z0-9._]{2,30})/);
    if (at) {
      name = at[1];
    } else if (HANDLE_RE.test(line)) {
      name = line;
    } else {
      const tok = line.split(/\s+/)[0].replace(/^@/, "");
      if (HANDLE_RE.test(tok)) name = tok;
      // 한글 닉네임 등: 공백 없는 짧은 줄만 이름으로 인정 (댓글 본문 오인 방지)
      else if (!line.includes(" ") && line.length <= 20) name = line;
    }
    if (!name) continue;
    const key = name.toLowerCase();
    if (excludes.has(key)) continue;
    if (dedupe) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(name);
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = "setup" | "race" | "done";

type MarbleInfo = {
  body: Matter.Body;
  name: string;
  color: string;
  finished: boolean;
};

type StaticInfo = { body: Matter.Body; color: string };

type LiveInfo = {
  finished: { name: string; color: string }[];
  leaders: { name: string; color: string }[];
};

export default function MarbleRace() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [raw, setRaw] = useState("");
  const [winnerCount, setWinnerCount] = useState(1);
  const [dedupe, setDedupe] = useState(true);
  const [excludeRaw, setExcludeRaw] = useState("");
  const [runId, setRunId] = useState(0);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [live, setLive] = useState<LiveInfo>({ finished: [], leaders: [] });
  const [winners, setWinners] = useState<{ name: string; color: string }[]>([]);
  const [speed, setSpeed] = useState(1);
  const [copied, setCopied] = useState(false);

  const speedRef = useRef(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const racersRef = useRef<string[]>([]);

  const participants = useMemo(
    () => parseParticipants(raw, dedupe, excludeRaw),
    [raw, dedupe, excludeRaw]
  );
  const overCap = participants.length > MAX_PARTICIPANTS;

  const startRace = () => {
    racersRef.current = participants.slice(0, MAX_PARTICIPANTS);
    setWinners([]);
    setLive({ finished: [], leaders: [] });
    setSpeed(1);
    speedRef.current = 1;
    setRunId((v) => v + 1);
    setPhase("race");
  };

  const cycleSpeed = () => {
    const next = speed === 1 ? 2 : speed === 2 ? 4 : 1;
    setSpeed(next);
    speedRef.current = next;
  };

  const copyWinners = async () => {
    try {
      await navigator.clipboard.writeText(winners.map((w) => `@${w.name}`).join(" "));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard 미지원 브라우저 무시 */
    }
  };

  // ── 레이스 시뮬레이션 ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "race") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const names = shuffle(racersRef.current);
    const n = names.length;
    const targetWins = Math.min(winnerCount, n);
    const r = n <= 60 ? 11 : n <= 150 ? 9 : n <= 280 ? 7.5 : 6.5;
    const labelAll = n <= 120;

    const engine = Matter.Engine.create();
    engine.gravity.y = 1;
    const world = engine.world;

    // 트랙 구성
    const statics: StaticInfo[] = [];
    const addStatic = (body: Matter.Body, color: string) => {
      statics.push({ body, color });
      Matter.Composite.add(world, body);
    };
    const B = Matter.Bodies;

    addStatic(B.rectangle(-14, WORLD_H / 2, 28, WORLD_H * 2, { isStatic: true }), NAVY);
    addStatic(B.rectangle(WORLD_W + 14, WORLD_H / 2, 28, WORLD_H * 2, { isStatic: true }), NAVY);
    addStatic(B.rectangle(WORLD_W / 2, WORLD_H + 10, WORLD_W * 2, 40, { isStatic: true }), NAVY);

    // 핀볼 핀 구간 1
    for (let row = 0, y = 360; y <= 1160; y += 80, row++) {
      const off = row % 2 ? 34 : 0;
      for (let x = 40 + off; x <= WORLD_W - 40; x += 68) {
        addStatic(B.circle(x, y, 6, { isStatic: true, restitution: 0.4 }), NAVY);
      }
    }
    // 깔때기 1
    addStatic(B.rectangle(92, 1330, 230, 14, { isStatic: true, angle: 0.45 }), GREEN);
    addStatic(B.rectangle(WORLD_W - 92, 1330, 230, 14, { isStatic: true, angle: -0.45 }), GREEN);
    // 회전 장애물
    const spinners: { body: Matter.Body; speed: number }[] = [];
    const addSpinner = (x: number, y: number, w: number, sp: number) => {
      const body = B.rectangle(x, y, w, 12, { isStatic: true });
      spinners.push({ body, speed: sp });
      statics.push({ body, color: YELLOW });
      Matter.Composite.add(world, body);
    };
    addSpinner(240, 1560, 170, 0.035);
    addSpinner(120, 1840, 130, -0.045);
    addSpinner(360, 1840, 130, 0.045);
    // 핀볼 핀 구간 2
    for (let row = 0, y = 2040; y <= 2760; y += 80, row++) {
      const off = row % 2 ? 34 : 0;
      for (let x = 40 + off; x <= WORLD_W - 40; x += 68) {
        addStatic(B.circle(x, y, 6, { isStatic: true, restitution: 0.4 }), NAVY);
      }
    }
    // 깔때기 2
    addStatic(B.rectangle(96, 2930, 240, 14, { isStatic: true, angle: 0.45 }), GREEN);
    addStatic(B.rectangle(WORLD_W - 96, 2930, 240, 14, { isStatic: true, angle: -0.45 }), GREEN);
    // 지그재그 경사로
    addStatic(B.rectangle(150, 3140, 330, 14, { isStatic: true, angle: 0.14 }), GREEN);
    addStatic(B.rectangle(330, 3400, 330, 14, { isStatic: true, angle: -0.14 }), GREEN);
    addStatic(B.rectangle(150, 3660, 330, 14, { isStatic: true, angle: 0.14 }), GREEN);

    // 출발 게이트
    let gate: Matter.Body | null = B.rectangle(WORLD_W / 2, GATE_Y, WORLD_W, 24, { isStatic: true });
    Matter.Composite.add(world, gate);

    // 구슬 생성 (게이트 위에 격자로 쌓기)
    const marbles: MarbleInfo[] = [];
    const margin = 24;
    const cell = 2 * r + 5;
    const cols = Math.max(1, Math.floor((WORLD_W - margin * 2) / cell));
    let minSpawnY = GATE_Y;
    names.forEach((name, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = margin + r + col * cell + (Math.random() - 0.5) * 4;
      const y = GATE_Y - 14 - r - row * cell;
      minSpawnY = Math.min(minSpawnY, y);
      const body = B.circle(x, y, r, {
        restitution: 0.55,
        friction: 0.02,
        frictionAir: 0.012,
        density: 0.002,
      });
      Matter.Composite.add(world, body);
      marbles.push({ body, name, color: MARBLE_COLORS[i % MARBLE_COLORS.length], finished: false });
    });

    // 상태
    const finishers: { name: string; color: string }[] = [];
    let started = false;
    let ended = false;
    let stepCount = 0;
    let acc = 0;
    let last = performance.now();
    let cam = Math.max(minSpawnY - 60, -WORLD_H);
    let raf = 0;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const finishRace = () => {
      if (ended) return;
      ended = true;
      // 완주자가 모자라면 현재 위치(진행도) 순으로 채움
      const rest = marbles
        .filter((m) => !m.finished)
        .sort((a, b) => b.body.position.y - a.body.position.y)
        .map((m) => ({ name: m.name, color: m.color }));
      const finalWinners = [...finishers, ...rest].slice(0, targetWins);
      timeouts.push(
        setTimeout(() => {
          setWinners(finalWinners);
          setPhase("done");
        }, 1600)
      );
    };

    // 카운트다운 → 게이트 오픈
    setCountdown("3");
    timeouts.push(setTimeout(() => setCountdown("2"), 900));
    timeouts.push(setTimeout(() => setCountdown("1"), 1800));
    timeouts.push(
      setTimeout(() => {
        setCountdown("GO!");
        if (gate) {
          Matter.Composite.remove(world, gate);
          gate = null;
        }
        started = true;
      }, 2700)
    );
    timeouts.push(setTimeout(() => setCountdown(null), 3500));
    // 안전 타임아웃: 150초 내 미결정 시 진행도 순 확정
    timeouts.push(setTimeout(finishRace, 150000));

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const step = () => {
      stepCount++;
      for (const s of spinners) Matter.Body.setAngle(s.body, s.body.angle + s.speed);
      Matter.Engine.update(engine, 1000 / 60);

      // 멈춘 구슬 살짝 흔들기 (병목 방지)
      if (started && stepCount % 180 === 0) {
        for (const m of marbles) {
          if (m.finished) continue;
          const v = m.body.velocity;
          if (Math.hypot(v.x, v.y) < 0.2) {
            Matter.Body.applyForce(m.body, m.body.position, {
              x: (Math.random() - 0.5) * 0.004 * m.body.mass,
              y: -0.002 * m.body.mass,
            });
          }
        }
      }

      // 결승선 통과 판정
      if (started && !ended) {
        for (const m of marbles) {
          if (!m.finished && m.body.position.y > FINISH_Y) {
            m.finished = true;
            finishers.push({ name: m.name, color: m.color });
            Matter.Composite.remove(world, m.body);
            if (finishers.length >= targetWins) {
              finishRace();
              break;
            }
          }
        }
      }
    };

    const draw = (cssW: number, cssH: number, scale: number, viewH: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#eef1f8";
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, -cam * scale * dpr);

      const viewTop = cam - 60;
      const viewBottom = cam + viewH + 60;

      // 결승선 (체크무늬)
      if (FINISH_Y > viewTop && FINISH_Y < viewBottom) {
        const sq = 16;
        for (let i = 0; i < WORLD_W / sq; i++) {
          for (let j = 0; j < 2; j++) {
            ctx.fillStyle = (i + j) % 2 === 0 ? "#1f2937" : "#ffffff";
            ctx.fillRect(i * sq, FINISH_Y + j * sq, sq, sq);
          }
        }
        ctx.fillStyle = "#1f2937";
        ctx.font = "bold 22px Pretendard, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("FINISH", WORLD_W / 2, FINISH_Y - 14);
      }

      // 트랙
      for (const s of statics) {
        const b = s.body;
        if (b.bounds.max.y < viewTop || b.bounds.min.y > viewBottom) continue;
        ctx.fillStyle = s.color;
        if (b.circleRadius) {
          ctx.beginPath();
          ctx.arc(b.position.x, b.position.y, b.circleRadius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          const v = b.vertices;
          ctx.moveTo(v[0].x, v[0].y);
          for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
          ctx.closePath();
          ctx.fill();
        }
      }

      // 게이트
      if (gate) {
        ctx.fillStyle = YELLOW;
        const v = gate.vertices;
        ctx.beginPath();
        ctx.moveTo(v[0].x, v[0].y);
        for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
        ctx.closePath();
        ctx.fill();
      }

      // 구슬 + 라벨 (참가자가 많으면 선두권만 라벨)
      let labelSet: Set<Matter.Body> | null = null;
      if (!labelAll) {
        labelSet = new Set(
          marbles
            .filter((m) => !m.finished)
            .sort((a, b) => b.body.position.y - a.body.position.y)
            .slice(0, 40)
            .map((m) => m.body)
        );
      }
      ctx.textAlign = "center";
      for (const m of marbles) {
        if (m.finished) continue;
        const { x, y } = m.body.position;
        if (y < viewTop || y > viewBottom) continue;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = m.color;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        // 하이라이트
        ctx.beginPath();
        ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fill();
        if (labelAll || labelSet?.has(m.body)) {
          const label = m.name.length > 14 ? m.name.slice(0, 13) + "…" : m.name;
          ctx.font = `${r >= 9 ? 10 : 9}px Pretendard, sans-serif`;
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.strokeText(label, x, y - r - 4);
          ctx.fillStyle = "#1f2937";
          ctx.fillText(label, x, y - r - 4);
        }
      }
    };

    const tick = (now: number) => {
      const cssW = wrap.clientWidth;
      const cssH = wrap.clientHeight;
      if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
      }
      const scale = cssW / WORLD_W;
      const viewH = cssH / scale;

      const dt = Math.min(now - last, 48);
      last = now;
      acc += dt * speedRef.current;
      let guard = 0;
      while (acc >= 1000 / 60 && guard < 8) {
        step();
        acc -= 1000 / 60;
        guard++;
      }
      if (guard === 8) acc = 0;

      // 카메라: 선두 구슬 따라가기
      const active = marbles.filter((m) => !m.finished);
      const leaderY = active.length
        ? Math.max(...active.map((m) => m.body.position.y))
        : FINISH_Y;
      const target = Math.min(
        Math.max(leaderY - viewH * 0.42, minSpawnY - 60),
        WORLD_H - viewH + 20
      );
      cam += (target - cam) * 0.08;

      draw(cssW, cssH, scale, viewH);

      // 실시간 순위 (스로틀)
      if (stepCount % 20 === 0) {
        const leaders = active
          .sort((a, b) => b.body.position.y - a.body.position.y)
          .slice(0, 5)
          .map((m) => ({ name: m.name, color: m.color }));
        setLive({ finished: [...finishers], leaders });
      }

    };

    // 화면 표시 중엔 rAF로 부드럽게, 탭이 가려지면 타이머로 계속 진행
    let lastTickAt = performance.now();
    const rafLoop = (now: number) => {
      lastTickAt = now;
      tick(now);
      raf = requestAnimationFrame(rafLoop);
    };
    raf = requestAnimationFrame(rafLoop);
    const watchdog = setInterval(() => {
      const now = performance.now();
      if (now - lastTickAt > 100) {
        lastTickAt = now;
        tick(now);
      }
    }, 50);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(watchdog);
      timeouts.forEach(clearTimeout);
      Matter.Engine.clear(engine);
      Matter.Composite.clear(world, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, runId]);

  // ── 화면 ────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <main className="w-full min-h-dvh bg-gray-50 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-md">
          <header className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-3xl">🎱</span>
              <h1 className="text-2xl font-bold" style={{ color: NAVY }}>
                다즐 마블 추첨기
              </h1>
            </div>
            <p className="text-sm text-gray-500">
              댓글 이벤트 당첨자를 마블 레이스로 공정하고 재미있게!
            </p>
          </header>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                참가자 명단
              </label>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={9}
                placeholder={
                  "인스타 댓글에서 아이디를 복사해 붙여넣으세요.\n한 줄에 한 명씩 · @는 있어도 없어도 OK\n\n예)\n@dazzle_fan1\nhotple_lover\n김다즐"
                }
                className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1d3b8b]/30 resize-y"
              />
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="font-medium" style={{ color: participants.length ? GREEN : "#9ca3af" }}>
                  인식된 참가자 {participants.length}명
                  {overCap && ` (최대 ${MAX_PARTICIPANTS}명까지만 참여)`}
                </span>
              </div>
              {participants.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {participants.slice(0, 30).map((p, i) => (
                    <span
                      key={`${p}-${i}`}
                      className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-600"
                    >
                      {p}
                    </span>
                  ))}
                  {participants.length > 30 && (
                    <span className="px-2 py-0.5 text-[11px] text-gray-400">
                      +{participants.length - 30}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  당첨 인원
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={winnerCount}
                  onChange={(e) =>
                    setWinnerCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                  }
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-[#1d3b8b]/30"
                />
              </div>
              <div className="flex-[2]">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  제외할 계정 <span className="font-normal text-gray-400">(선택)</span>
                </label>
                <input
                  type="text"
                  value={excludeRaw}
                  onChange={(e) => setExcludeRaw(e.target.value)}
                  placeholder="dazzle_people, ..."
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1d3b8b]/30"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dedupe}
                onChange={(e) => setDedupe(e.target.checked)}
                className="w-4 h-4 accent-[#1d3b8b]"
              />
              같은 아이디 중복 제거
              <span className="text-xs text-gray-400">(끄면 댓글 수만큼 구슬 추가)</span>
            </label>

            <button
              onClick={startRace}
              disabled={participants.length < 2 || participants.length < winnerCount}
              className="w-full py-3.5 rounded-xl font-bold text-white text-base transition-opacity disabled:opacity-40"
              style={{ background: NAVY }}
            >
              🏁 레이스 시작!
            </button>
            {participants.length > 0 && participants.length < winnerCount && (
              <p className="text-xs text-center text-red-500">
                당첨 인원보다 참가자가 많아야 해요.
              </p>
            )}
          </section>

          <p className="mt-4 text-center text-[11px] text-gray-400">
            물리 시뮬레이션 기반 무작위 추첨 · 화면 녹화해서 릴스/스토리로 발표해 보세요 📱
          </p>
        </div>
      </main>
    );
  }

  if (phase === "race") {
    return (
      <main className="w-full h-dvh bg-gray-50 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎱</span>
            <span className="font-bold text-sm" style={{ color: NAVY }}>
              다즐 마블 레이스
            </span>
            <span className="text-xs text-gray-400">{racersRef.current.length}명 참가</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cycleSpeed}
              className="px-2.5 py-1 rounded-lg text-xs font-bold border border-gray-200 text-gray-600"
            >
              ⏩ {speed}x
            </button>
            <button
              onClick={() => setPhase("setup")}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-400 border border-gray-200"
            >
              중단
            </button>
          </div>
        </div>

        <div ref={wrapRef} className="relative flex-1 max-w-md w-full mx-auto min-h-0">
          <canvas ref={canvasRef} className="w-full h-full block" />

          {/* 실시간 순위 */}
          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur rounded-xl shadow-sm px-3 py-2 text-[11px] space-y-1 max-w-[45%]">
            {live.finished.map((f, i) => (
              <div key={`f-${i}`} className="flex items-center gap-1.5 font-bold">
                <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}위`}</span>
                <span className="truncate" style={{ color: NAVY }}>
                  {f.name}
                </span>
              </div>
            ))}
            {live.leaders.map((l, i) => (
              <div key={`l-${i}`} className="flex items-center gap-1.5 text-gray-500">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: l.color }}
                />
                <span className="truncate">{l.name}</span>
              </div>
            ))}
          </div>

          {/* 카운트다운 */}
          {countdown && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span
                className="text-7xl font-black drop-shadow-lg"
                style={{ color: countdown === "GO!" ? GREEN : YELLOW }}
              >
                {countdown}
              </span>
            </div>
          )}
        </div>
      </main>
    );
  }

  // done
  return (
    <main className="w-full min-h-dvh bg-gray-50 flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      <Confetti />
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 p-6 relative z-10">
        <div className="text-center mb-5">
          <div className="text-4xl mb-1">🎉</div>
          <h2 className="text-xl font-bold" style={{ color: NAVY }}>
            당첨을 축하합니다!
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {racersRef.current.length}명 중 {winners.length}명 당첨
          </p>
        </div>

        <ul className="space-y-2 mb-6">
          {winners.map((w, i) => (
            <li
              key={`${w.name}-${i}`}
              className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3"
              style={{ background: i === 0 ? "#fdf6dd" : "#f9fafb" }}
            >
              <span className="text-xl">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🏅"}
              </span>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: w.color }} />
              <span className="font-bold text-gray-800 truncate">@{w.name}</span>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={copyWinners}
            className="py-3 rounded-xl font-bold text-sm border-2"
            style={{ borderColor: NAVY, color: NAVY }}
          >
            {copied ? "✅ 복사됨!" : "📋 당첨자 복사"}
          </button>
          <button
            onClick={startRace}
            className="py-3 rounded-xl font-bold text-sm text-white"
            style={{ background: NAVY }}
          >
            🔄 다시 추첨
          </button>
        </div>
        <button
          onClick={() => setPhase("setup")}
          className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold text-gray-400"
        >
          명단 수정하기
        </button>
      </div>
    </main>
  );
}

// ── 축하 콘페티 ───────────────────────────────────────────────────
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        duration: 3 + Math.random() * 2.5,
        size: 6 + Math.random() * 6,
        color: MARBLE_COLORS[i % MARBLE_COLORS.length],
        rotate: Math.random() * 360,
      })),
    []
  );
  return (
    <div className="absolute inset-0 pointer-events-none z-0" aria-hidden>
      <style>{`
        @keyframes dz-confetti-fall {
          0% { transform: translateY(-8vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(108vh) rotate(720deg); opacity: 0.6; }
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 block"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            borderRadius: 2,
            transform: `rotate(${p.rotate}deg)`,
            animation: `dz-confetti-fall ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
