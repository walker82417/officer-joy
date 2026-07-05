import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  component: StudyTimetable,
});

/* =============================================================
   DATA
   ============================================================= */
type Row = {
  id: number;
  time: string;
  startMin: number;
  dur: number;
  act: string;
  focus: string;
  cat: "life" | "technical" | "break" | "aptitude" | "gs";
  icon: string;
};

const ROWS: Row[] = [
  { id: 0, time: "6:00 – 6:15 AM", startMin: 360, dur: 15, act: "WAKE UP", focus: "Gratitude & Plan Your Day", cat: "life", icon: "☀️" },
  { id: 1, time: "6:15 – 6:45 AM", startMin: 375, dur: 30, act: "EXERCISE / YOGA / WALK", focus: "Stay Fit, Stay Sharp", cat: "life", icon: "🏃" },
  { id: 2, time: "6:45 – 7:15 AM", startMin: 405, dur: 30, act: "FRESHEN UP", focus: "Personal Care", cat: "life", icon: "🚿" },
  { id: 3, time: "7:15 – 7:45 AM", startMin: 435, dur: 30, act: "BREAKFAST", focus: "Eat Healthy, Think Better", cat: "life", icon: "🥣" },
  { id: 4, time: "7:45 – 10:15 AM", startMin: 465, dur: 150, act: "ELECTRICAL ENGINEERING (THEORY)", focus: "Core Subject – ESE / MPSC / SSC JE / RRB JE", cat: "technical", icon: "📖" },
  { id: 5, time: "10:15 – 10:30 AM", startMin: 615, dur: 15, act: "SHORT BREAK", focus: "Tea / Break", cat: "break", icon: "☕" },
  { id: 6, time: "10:30 – 1:00 PM", startMin: 630, dur: 150, act: "ELECTRICAL ENGINEERING (NUMERICALS)", focus: "Numericals + Problem Solving", cat: "technical", icon: "🧮" },
  { id: 7, time: "1:00 – 2:00 PM", startMin: 780, dur: 60, act: "LUNCH & REST", focus: "Good Food, Good Mood", cat: "life", icon: "🍽️" },
  { id: 8, time: "2:00 – 4:00 PM", startMin: 840, dur: 120, act: "PYQs & MCQs PRACTICE", focus: "ESE / SSC JE / RRB JE", cat: "technical", icon: "🎯" },
  { id: 9, time: "4:00 – 4:30 PM", startMin: 960, dur: 30, act: "TEA BREAK", focus: "Short Break, Fresh Mind", cat: "break", icon: "☕" },
  { id: 10, time: "4:30 – 5:30 PM", startMin: 990, dur: 60, act: "QUANTITATIVE APTITUDE", focus: "SSC / Railways / CGL", cat: "aptitude", icon: "Σ" },
  { id: 11, time: "5:30 – 6:30 PM", startMin: 1050, dur: 60, act: "REASONING ABILITY", focus: "SSC / Railways / CGL", cat: "aptitude", icon: "🧠" },
  { id: 12, time: "6:30 – 7:30 PM", startMin: 1110, dur: 60, act: "GENERAL STUDIES & CURRENT AFFAIRS", focus: "Polity, History, Geography, Economy, Science, CA", cat: "gs", icon: "🌐" },
  { id: 13, time: "7:30 – 8:15 PM", startMin: 1170, dur: 45, act: "DINNER & FAMILY TIME", focus: "Take a Break, Stay Connected", cat: "life", icon: "👨‍👩‍👧" },
  { id: 14, time: "8:15 – 9:15 PM", startMin: 1215, dur: 60, act: "ENGLISH", focus: "Grammar, Vocabulary, RC", cat: "gs", icon: "🔤" },
  { id: 15, time: "9:15 – 10:00 PM", startMin: 1275, dur: 45, act: "REVISION & MOCK ANALYSIS", focus: "Mock Test / Error Analysis / Short Notes", cat: "technical", icon: "🔍" },
  { id: 16, time: "10:00 PM", startMin: 1320, dur: 0, act: "SLEEP", focus: "Good Sleep, Better Tomorrow", cat: "life", icon: "🌙" },
];
const isFocusRow = (r: Row) => r.cat === "technical" || r.cat === "aptitude" || r.cat === "gs";

const ROTATION: [string, string][] = [
  ["Mon", "Network Theory + Engineering Maths"],
  ["Tue", "Electrical Machines"],
  ["Wed", "Power Systems"],
  ["Thu", "Control Systems"],
  ["Fri", "Power Electronics"],
  ["Sat", "Electronics (Analog + Digital)"],
  ["Sun", "Full Length Mock Test + Revision"],
];
const CHECKLIST_ITEMS = [
  "Wake Up",
  "Exercise",
  "Breakfast",
  "Theory Completed",
  "Numericals Completed",
  "PYQs",
  "Aptitude",
  "Revision",
  "Sleep Before 10 PM",
];
const QUOTES = [
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "Don't stop when you're tired. Stop when you're done.",
  "Discipline today, success tomorrow.",
  "Small daily improvements are the key to stunning results.",
  "Your future is created by what you do today, not tomorrow.",
  "One day or day one. You decide.",
  "Consistency beats intensity.",
];
type ExamKey = "ssc" | "gate" | "ese";
const EXAMS_DEFAULT: Record<ExamKey, { label: string; date: string }> = {
  ssc: { label: "SSC JE 2027", date: "2027-06-01" },
  gate: { label: "GATE 2028", date: "2028-02-04" },
  ese: { label: "UPSC ESE 2028", date: "2028-02-25" },
};

type SessionStatus = "notstarted" | "running" | "paused" | "completed";
type SessionRec = { status: SessionStatus; remaining: number; endTs: number | null; warned: boolean };
type CompletedLog = { date: string; rowId: number; cat: Row["cat"]; durMin: number; ts: number };

/* =============================================================
   STORAGE
   ============================================================= */
const todayKey = () => new Date().toISOString().slice(0, 10);
function load<T>(key: string, def: T): T {
  if (typeof window === "undefined") return def;
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : def;
  } catch {
    return def;
  }
}
function save<T>(key: string, val: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* quota */
  }
}

/* =============================================================
   HELPERS
   ============================================================= */
function fmtTime(sec: number) {
  sec = Math.max(0, sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
function minsToClock(mins: number) {
  mins = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}
function countdownParts(dateStr: string) {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  let diff = target.getTime() - now.getTime();
  if (diff < 0) diff = 0;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s };
}
function initSessions(): Record<number, SessionRec> {
  const out: Record<number, SessionRec> = {};
  ROWS.forEach((r) => {
    out[r.id] = { status: "notstarted", remaining: r.dur * 60, endTs: null, warned: false };
  });
  return out;
}
function initChecklist(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  CHECKLIST_ITEMS.forEach((it) => (out[it] = false));
  return out;
}

/* =============================================================
   COMPONENT
   ============================================================= */
function StudyTimetable() {
  const [mounted, setMounted] = useState(false);
  const [nowTick, setNowTick] = useState(0);
  const [examDates, setExamDates] = useState(EXAMS_DEFAULT);
  const [sessions, setSessions] = useState<Record<number, SessionRec>>(initSessions);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(initChecklist);
  const [pending, setPending] = useState<number[]>([]);
  const [heatmapLog, setHeatmapLog] = useState<Record<string, number>>({});
  const [completedLog, setCompletedLog] = useState<CompletedLog[]>([]);
  const [timeShift, setTimeShift] = useState(0);
  const [editingExam, setEditingExam] = useState<ExamKey | null>(null);
  const [extendFor, setExtendFor] = useState<{ id: number; x: number; y: number } | null>(null);

  const soundOnRef = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const scaleWrapRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLCanvasElement | null>(null);

  /* -- hydrate from localStorage after mount -- */
  useEffect(() => {
    setExamDates(load("tt_examDates", EXAMS_DEFAULT));
    const s = load<Record<number, SessionRec>>("tt_sessions_" + todayKey(), initSessions());
    ROWS.forEach((r) => {
      if (!s[r.id]) s[r.id] = { status: "notstarted", remaining: r.dur * 60, endTs: null, warned: false };
    });
    setSessions(s);
    const c = load<Record<string, boolean>>("tt_checklist_" + todayKey(), initChecklist());
    CHECKLIST_ITEMS.forEach((it) => {
      if (c[it] === undefined) c[it] = false;
    });
    setChecklist(c);
    setPending(load("tt_pending_" + todayKey(), []));
    setHeatmapLog(load("tt_heatmap", {}));
    setCompletedLog(load("tt_completedLog", []));
    setTimeShift(load("tt_shift_" + todayKey(), 0));
    soundOnRef.current = load("tt_soundOn", true);
    setMounted(true);
  }, []);

  /* -- persist -- */
  useEffect(() => { if (mounted) save("tt_examDates", examDates); }, [examDates, mounted]);
  useEffect(() => { if (mounted) save("tt_sessions_" + todayKey(), sessions); }, [sessions, mounted]);
  useEffect(() => { if (mounted) save("tt_checklist_" + todayKey(), checklist); }, [checklist, mounted]);
  useEffect(() => { if (mounted) save("tt_pending_" + todayKey(), pending); }, [pending, mounted]);
  useEffect(() => { if (mounted) save("tt_heatmap", heatmapLog); }, [heatmapLog, mounted]);
  useEffect(() => { if (mounted) save("tt_completedLog", completedLog); }, [completedLog, mounted]);
  useEffect(() => { if (mounted) save("tt_shift_" + todayKey(), timeShift); }, [timeShift, mounted]);

  /* -- sound -- */
  const playTone = useCallback((freq: number, duration: number, vol: number, type: OscillatorType = "sine") => {
    if (!soundOnRef.current) return;
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.02);
    } catch { /* ignore */ }
  }, []);
  const playStartChime = useCallback(() => { playTone(523, 0.18, 0.12); setTimeout(() => playTone(659, 0.22, 0.12), 120); }, [playTone]);
  const playCompleteChime = useCallback(() => { playTone(659, 0.16, 0.12); setTimeout(() => playTone(880, 0.28, 0.12), 140); }, [playTone]);
  const playCountdownBlip = useCallback(() => { playTone(740, 0.1, 0.09); }, [playTone]);

  /* -- 1-second tick: countdown + timers + auto-complete -- */
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Timer tick logic (runs each nowTick change)
  useEffect(() => {
    if (!mounted) return;
    const now = Date.now();
    let changed = false;
    const nextSessions = { ...sessions };
    const toComplete: number[] = [];
    ROWS.forEach((r) => {
      if (!isFocusRow(r)) return;
      const st = nextSessions[r.id];
      if (st.status === "running" && st.endTs) {
        const remaining = Math.round((st.endTs - now) / 1000);
        if (remaining <= 5 && remaining > 0 && !st.warned) {
          playCountdownBlip();
        }
        if (remaining <= 0) {
          toComplete.push(r.id);
        } else if (remaining !== st.remaining) {
          nextSessions[r.id] = { ...st, remaining };
          changed = true;
        }
      }
    });
    if (changed) setSessions(nextSessions);
    toComplete.forEach((id) => completeSession(id, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowTick, mounted]);

  /* -- pending auto-check every 60s -- */
  useEffect(() => {
    if (!mounted) return;
    const check = () => {
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      setPending((prev) => {
        const next = [...prev];
        ROWS.forEach((r) => {
          if (!isFocusRow(r)) return;
          const st = sessions[r.id];
          const endMin = r.startMin + r.dur + timeShift;
          if (st && st.status === "notstarted" && nowMin > endMin && !next.includes(r.id)) {
            next.push(r.id);
          }
        });
        return next.length === prev.length ? prev : next;
      });
    };
    check();
    const id = window.setInterval(check, 60000);
    return () => window.clearInterval(id);
  }, [sessions, timeShift, mounted]);

  /* -- fit to screen -- */
  const fitScreen = useCallback(() => {
    const app = appRef.current;
    const wrap = scaleWrapRef.current;
    if (!app || !wrap) return;
    wrap.style.transform = "scale(1)";
    wrap.style.width = "auto";
    wrap.style.height = "auto";
    const naturalH = app.offsetHeight;
    const naturalW = app.offsetWidth;
    const scale = Math.min(window.innerWidth / naturalW, window.innerHeight / naturalH, 1);
    wrap.style.transform = `scale(${scale})`;
    wrap.style.width = naturalW + "px";
    wrap.style.height = naturalH + "px";
    const leftOffset = (window.innerWidth - naturalW * scale) / 2;
    const topOffset = (window.innerHeight - naturalH * scale) / 2;
    wrap.style.left = Math.max(leftOffset, 0) + "px";
    wrap.style.top = Math.max(topOffset, 0) + "px";
  }, []);
  useEffect(() => {
    fitScreen();
    let t: number | undefined;
    const onResize = () => { window.clearTimeout(t); t = window.setTimeout(fitScreen, 80); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitScreen, pending.length, mounted]);

  /* -- ring canvas render -- */
  const totalFocus = useMemo(() => ROWS.filter(isFocusRow).length, []);
  const doneToday = useMemo(
    () => completedLog.filter((l) => l.date === todayKey()),
    [completedLog],
  );
  const streak = useMemo(() => {
    let s = 0;
    const d = new Date();
    while (true) {
      const key = d.toISOString().slice(0, 10);
      if (heatmapLog[key] && heatmapLog[key] > 0) { s++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return s;
  }, [heatmapLog]);
  useEffect(() => {
    const cvs = ringRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const size = 84;
    cvs.width = size * dpr;
    cvs.height = size * dpr;
    cvs.style.width = size + "px";
    cvs.style.height = size + "px";
    ctx.scale(dpr, dpr);
    const pct = totalFocus ? doneToday.length / totalFocus : 0;
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2, cy = size / 2, r = 34, lw = 12;
    ctx.lineWidth = lw;
    ctx.strokeStyle = "#e6e8f0";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    if (pct > 0) {
      ctx.strokeStyle = "#2a9d5c";
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      ctx.stroke();
    }
    ctx.fillStyle = "#1f2870";
    ctx.font = "700 16px Oswald, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Math.round(pct * 100) + "%", cx, cy);
  }, [totalFocus, doneToday.length, nowTick]);

  /* =========================================================
     ACTIONS
     ========================================================= */
  const startSession = useCallback((id: number) => {
    setSessions((prev) => {
      const st = prev[id];
      if (st.status === "notstarted" || st.status === "paused") {
        playStartChime();
        return {
          ...prev,
          [id]: { ...st, status: "running", endTs: Date.now() + st.remaining * 1000, warned: false },
        };
      }
      return prev;
    });
    setPending((p) => p.filter((x) => x !== id));
  }, [playStartChime]);

  const pauseSession = useCallback((id: number) => {
    setSessions((prev) => {
      const st = prev[id];
      if (st.status === "running" && st.endTs) {
        const remaining = Math.round((st.endTs - Date.now()) / 1000);
        return { ...prev, [id]: { ...st, status: "paused", remaining, endTs: null } };
      }
      return prev;
    });
  }, []);

  const completeSession = useCallback((id: number, auto = false) => {
    const row = ROWS.find((r) => r.id === id);
    if (!row) return;
    setSessions((prev) => {
      if (prev[id].status === "completed") return prev;
      return { ...prev, [id]: { ...prev[id], status: "completed", remaining: 0, endTs: null } };
    });
    setPending((p) => p.filter((x) => x !== id));
    setCompletedLog((prev) => {
      if (prev.some((l) => l.rowId === id && l.date === todayKey())) return prev;
      return [...prev, { date: todayKey(), rowId: id, cat: row.cat, durMin: row.dur, ts: Date.now() }];
    });
    setHeatmapLog((prev) => ({ ...prev, [todayKey()]: (prev[todayKey()] || 0) + 1 }));
    playCompleteChime();
    void auto;
  }, [playCompleteChime]);

  const extendSession = useCallback((id: number, minutes: number) => {
    setSessions((prev) => {
      const st = prev[id];
      const remaining = st.remaining + minutes * 60;
      const endTs = st.status === "running" ? Date.now() + remaining * 1000 : null;
      return { ...prev, [id]: { ...st, remaining, warned: false, endTs } };
    });
    setTimeShift((t) => t + minutes);
  }, []);

  const saveExamDate = useCallback((key: ExamKey, val: string) => {
    if (!val) return;
    setExamDates((prev) => ({ ...prev, [key]: { ...prev[key], date: val } }));
    setEditingExam(null);
  }, []);

  const toggleCheck = useCallback((item: string, val: boolean) => {
    setChecklist((prev) => ({ ...prev, [item]: val }));
  }, []);

  /* =========================================================
     DERIVED VIEW STATE
     ========================================================= */
  void nowTick; // consume for reactivity

  const now = new Date();
  const hh = now.getHours();
  const greet = hh < 12 ? "Good Morning" : hh < 17 ? "Good Afternoon" : "Good Evening";
  const greetLine = mounted
    ? `${greet}, Officer Rohan — ${now.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}`
    : "Good Morning, Officer Rohan";
  const clockLine = mounted ? now.toLocaleTimeString("en-IN", { hour12: true }) : "--:--:--";
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const dailyQuote = QUOTES[dayOfYear % QUOTES.length];

  const displayedStart = (row: Row) => {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (row.startMin > nowMin) return minsToClock(row.startMin + timeShift);
    return row.time.split("–")[0].trim();
  };

  const runningRow = ROWS.find((r) => isFocusRow(r) && sessions[r.id]?.status === "running") || null;
  const runningSt = runningRow ? sessions[runningRow.id] : null;

  const todayIdx = (now.getDay() + 6) % 7;

  /* heatmap cells (84 days) */
  const heatmapCells = useMemo(() => {
    const cells: { key: string; count: number }[] = [];
    const today = new Date();
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      cells.push({ key, count: heatmapLog[key] || 0 });
    }
    return cells;
  }, [heatmapLog]);

  /* analytics */
  const analytics = useMemo(() => {
    const nowD = new Date();
    const weekAgo = new Date(nowD); weekAgo.setDate(nowD.getDate() - 6);
    const monthAgo = new Date(nowD); monthAgo.setDate(nowD.getDate() - 29);
    const inRange = (dstr: string, from: Date) => new Date(dstr) >= new Date(from.toISOString().slice(0, 10));
    const todayLogs = completedLog.filter((l) => l.date === todayKey());
    const weekLogs = completedLog.filter((l) => inRange(l.date, weekAgo));
    const monthLogs = completedLog.filter((l) => inRange(l.date, monthAgo));
    const sum = (arr: CompletedLog[]) => arr.reduce((a, b) => a + b.durMin, 0);
    const avgSession = completedLog.length ? Math.round(sum(completedLog) / completedLog.length) : 0;
    const longest = completedLog.length ? Math.max(...completedLog.map((l) => l.durMin)) : 0;
    const bySubject: Record<string, number> = {};
    completedLog.forEach((l) => { const r = ROWS.find((x) => x.id === l.rowId); if (r) bySubject[r.act] = (bySubject[r.act] || 0) + l.durMin; });
    const mostStudied = Object.keys(bySubject).sort((a, b) => bySubject[b] - bySubject[a])[0] || "—";
    const byDay: Record<string, number> = { ...heatmapLog };
    const bestDay = Object.keys(byDay).sort((a, b) => byDay[b] - byDay[a])[0] || "—";
    const weakDay = Object.entries(byDay).filter(([, v]) => v > 0).sort((a, b) => a[1] - b[1])[0]?.[0] || "—";
    return {
      cells: [
        ["TODAY", (sum(todayLogs) / 60).toFixed(1) + "h"],
        ["THIS WEEK", (sum(weekLogs) / 60).toFixed(1) + "h"],
        ["THIS MONTH", (sum(monthLogs) / 60).toFixed(1) + "h"],
        ["COMPLETED SESSIONS", String(completedLog.length)],
        ["AVG SESSION", avgSession + "m"],
        ["MOST STUDIED", mostStudied],
        ["LONGEST SESSION", longest + "m"],
        ["CURRENT STREAK", streak + "d"],
        ["BEST DAY", bestDay],
        ["WEAK DAY", weakDay],
      ] as [string, string][],
    };
  }, [completedLog, heatmapLog, streak]);

  /* =========================================================
     RENDER
     ========================================================= */
  return (
    <div className="tt-root">
      <div ref={scaleWrapRef} className="tt-scaleWrap">
        <div ref={appRef} className="tt-app">
          {/* EXAM STRIP */}
          <div className="tt-examStrip">
            {(["ssc", "gate", "ese"] as ExamKey[]).map((key) => {
              const e = examDates[key];
              const c = mounted ? countdownParts(e.date) : { d: 0, h: 0, m: 0, s: 0 };
              return (
                <div
                  key={key}
                  className={`tt-examBox ${key}`}
                  onClick={() => setEditingExam((cur) => (cur === key ? null : key))}
                >
                  <div className="tt-num">
                    {mounted
                      ? `${c.d}d : ${String(c.h).padStart(2, "0")}h : ${String(c.m).padStart(2, "0")}m : ${String(c.s).padStart(2, "0")}s`
                      : "-- : -- : -- : --"}
                  </div>
                  <div className="tt-lbl">TO {e.label}</div>
                  <div className="tt-sub">target: {e.date} (tap to edit)</div>
                  {editingExam === key && (
                    <div className="tt-examEdit" onClick={(ev) => ev.stopPropagation()}>
                      <input
                        type="date"
                        defaultValue={e.date}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") saveExamDate(key, (ev.target as HTMLInputElement).value);
                        }}
                        id={`edit_${key}`}
                      />
                      <button
                        onClick={() => {
                          const el = document.getElementById(`edit_${key}`) as HTMLInputElement | null;
                          if (el) saveExamDate(key, el.value);
                        }}
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>


          {/* HEADER */}
          <div className="tt-header">
            <div className="tt-headerTop">
              <div style={{ width: 150 }}>
                <div className="tt-brandIcon">💡</div>
                <div className="tt-rulesList">
                  <div><span>✔</span>Plan Your Work</div>
                  <div><span>✔</span>Work Your Plan</div>
                  <div><span>✔</span>Stay Consistent</div>
                  <div><span>✔</span>Success is Inevitable</div>
                </div>
              </div>
              <div className="tt-titleBlock">
                <h1>UNIVERSAL STUDY TIMETABLE</h1>
                <div className="tt-examTags">
                  <b className="blue">UPSC ESE (ELECTRICAL)</b> | <b className="red">MPSC</b> | <b className="green">SSC JE</b> | <b className="purple">RRB JE</b> | <b className="orange">SSC CGL</b> | <b className="blue">RAILWAYS</b> &amp; OTHER GOVT. EXAMS
                </div>
                <div className="tt-motto">★ ★ &nbsp; ONE DAY OR DAY ONE. YOU DECIDE. &nbsp; ★ ★</div>
              </div>
              <div style={{ width: 150 }}>
                <div className="tt-targetBlock">
                  🎯<br />
                  <span className="t1">FOCUS</span><br />
                  <span className="t2">DISCIPLINE</span><br />
                  <span className="t3">SUCCESS</span>
                </div>
              </div>
            </div>

            <div className="tt-liveRow">
              <div className="tt-greet">{greetLine}</div>
              <div className="tt-clock">{clockLine}</div>
            </div>
            <div className="tt-quoteBar">&ldquo;{dailyQuote}&rdquo;</div>

            <div
              className={`tt-currentSessionBar ${runningRow ? "active" : ""} ${
                runningSt && runningSt.remaining <= 5 && runningRow ? "warn" : ""
              }`}
            >
              <span>CURRENT SESSION</span>
              <span>{runningRow ? `${runningRow.icon} ${runningRow.act}` : "No Active Study Session"}</span>
              <span className="tt-timerBig">{runningSt ? fmtTime(runningSt.remaining) : ""}</span>
            </div>
          </div>

          {/* MAIN GRID */}
          <div className="tt-mainGrid">
            <div className="tt-leftCol">
              <table className="tt-table">
                <thead>
                  <tr>
                    <th style={{ width: "4%" }}></th>
                    <th style={{ width: "9%" }}>TIME</th>
                    <th style={{ width: "29%" }}>ACTIVITY</th>
                    <th style={{ width: "29%" }}>FOCUS / SUBJECT</th>
                    <th style={{ width: "8%" }}>STATUS</th>
                    <th style={{ width: "9%" }}>TIMER</th>
                    <th style={{ width: "12%" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => {
                    if (!isFocusRow(r)) {
                      return (
                        <tr key={r.id} className="tt-rowLIFE">
                          <td className="tt-rowIcon">{r.icon}</td>
                          <td>{displayedStart(r)}</td>
                          <td><b>{r.act}</b></td>
                          <td>{r.focus}</td>
                          <td colSpan={3} style={{ textAlign: "center", color: "#bbb" }}>— not a focus session —</td>
                        </tr>
                      );
                    }
                    const st = sessions[r.id];
                    const rowClass = st.status === "running" ? "tt-rowRUN" : st.status === "paused" ? "tt-rowPAUSE" : st.status === "completed" ? "tt-rowDONE" : "tt-rowNS";
                    const pillClass = "tt-st-" + st.status;
                    const pillLabel = st.status === "notstarted" ? "NOT STARTED" : st.status.toUpperCase();
                    const critical = st.status === "running" && st.remaining <= 5;
                    const disableStart = st.status === "running" || st.status === "completed";
                    const disablePause = st.status !== "running";
                    const disableDone = st.status === "completed";
                    return (
                      <tr key={r.id} className={rowClass}>
                        <td className="tt-rowIcon">{r.icon}</td>
                        <td>{displayedStart(r)}</td>
                        <td><b>{r.act}</b></td>
                        <td>{r.focus}</td>
                        <td><span className={`tt-statusPill ${pillClass}`}>{pillLabel}</span></td>
                        <td className={`tt-rowTimer ${critical ? "critical" : ""}`}>{fmtTime(st.remaining)}</td>
                        <td className="tt-actBtns">
                          <button className="tt-b-start" title="Start" disabled={disableStart} onClick={() => startSession(r.id)}>▶</button>
                          <button className="tt-b-pause" title="Pause" disabled={disablePause} onClick={() => pauseSession(r.id)}>⏸</button>
                          <button
                            className="tt-b-ext"
                            title="Extend"
                            disabled={st.status === "completed"}
                            onClick={(ev) => setExtendFor({ id: r.id, x: ev.clientX, y: ev.clientY })}
                          >
                            ➕
                          </button>
                          <button className="tt-b-done" title="Complete" disabled={disableDone} onClick={() => completeSession(r.id)}>✓</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* PENDING */}
              <div className="tt-pendingBox">
                <h3>⚠ PENDING MISSIONS</h3>
                <div className="tt-pendingList">
                  {pending.length === 0 ? (
                    <span className="tt-pendingEmpty">Nothing pending. Great job, Officer.</span>
                  ) : (
                    pending.map((id) => {
                      const r = ROWS.find((x) => x.id === id);
                      if (!r) return null;
                      return (
                        <div key={id} className="tt-pendingItem">
                          {r.icon} {r.act} <span style={{ color: "#999" }}>({r.dur}m)</span>
                          <button onClick={() => startSession(id)}>Reschedule Now</button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* BOTTOM GRID */}
              <div className="tt-bottomGrid">
                <div className="tt-card">
                  <h3>EXAM COVERAGE</h3>
                  <div className="tt-cardBody">
                    <ul className="tt-examCoverage">
                      <li>UPSC ESE (Electrical)</li>
                      <li>MPSC Engineering Services</li>
                      <li>SSC JE</li>
                      <li>RRB JE / SSE</li>
                      <li>SSC CGL / CHSL / MTS</li>
                      <li>SSC GD</li>
                      <li>Railways NTPC / Group D &amp; Other Govt. Exams</li>
                    </ul>
                  </div>
                </div>
                <div className="tt-card">
                  <h3>TODAY&apos;S PROGRESS</h3>
                  <div className="tt-ringWrap">
                    <canvas ref={ringRef} className="tt-ringCanvas" />
                    <div className="tt-statList">
                      <div>Hours: <b>{(doneToday.reduce((a, b) => a + b.durMin, 0) / 60).toFixed(1)}h</b></div>
                      <div>Completed: <b>{doneToday.length}</b></div>
                      <div>Remaining: <b>{Math.max(totalFocus - doneToday.length, 0)}</b></div>
                      <div>Streak: <b>{streak}</b>d 🔥</div>
                    </div>
                  </div>
                </div>
                <div className="tt-card">
                  <h3>SUBJECT FOCUS (WEEKLY ROTATION)</h3>
                  <div className="tt-cardBody">
                    <table className="tt-rotationTable">
                      <tbody>
                        {ROTATION.map(([day, subj], i) => (
                          <tr key={day} className={i === todayIdx ? "today" : ""}>
                            <td><b>{day}</b></td>
                            <td>{subj}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="tt-card">
                  <h3>GOLDEN RULES</h3>
                  <div className="tt-cardBody">
                    <ul className="tt-goldenRules">
                      <li>Be Consistent</li>
                      <li>Follow the Plan</li>
                      <li>Avoid Distractions</li>
                      <li>Revise Regularly</li>
                      <li>Take Mock Tests</li>
                      <li>Analyze &amp; Improve</li>
                      <li>Believe in Yourself</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="tt-card" style={{ marginTop: 8 }}>
                <h3>ANALYTICS OVERVIEW</h3>
                <div className="tt-analyticsGrid">
                  {analytics.cells.map(([l, v]) => (
                    <div key={l}><b>{v}</b>{l}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="tt-rightCol tt-motivPanel">
              <h3>✦ Motivation for Champions ✦</h3>
              {[
                { cls: "tt-qc1", text: "The harder you work for something, the greater you'll feel when you achieve it." },
                { cls: "tt-qc2", text: "Don't stop when you're tired. Stop when you're done." },
                { cls: "tt-qc3", text: "Discipline today, success tomorrow." },
                { cls: "tt-qc4", text: "Small daily improvements are the key to stunning results." },
                { cls: "tt-qc5", text: "Your future is created by what you do today, not tomorrow." },
              ].map((q) => (
                <div key={q.cls} className={`tt-quoteCard ${q.cls}`}>
                  <span>&ldquo;{q.text}&rdquo;</span>
                </div>
              ))}
              <div className="tt-card" style={{ flex: "0 0 auto", marginTop: 2 }}>
                <h3>CONSISTENCY HEATMAP (12 weeks)</h3>
                <div className="tt-heatmapWrap">
                  <div className="tt-heatmapGrid">
                    {heatmapCells.map(({ key, count }) => {
                      let cls = "tt-hcell";
                      if (count >= 1 && count < 3) cls += " l1";
                      else if (count >= 3 && count < 6) cls += " l2";
                      else if (count >= 6 && count < 9) cls += " l3";
                      else if (count >= 9) cls += " l4";
                      return <div key={key} className={cls} title={`${key}: ${count} sessions`} />;
                    })}
                  </div>
                  <div className="tt-heatmapLegend">
                    Less <span className="tt-hcell" /><span className="tt-hcell l1" /><span className="tt-hcell l2" /><span className="tt-hcell l3" /><span className="tt-hcell l4" /> More
                  </div>
                </div>
              </div>
              <div className="tt-card" style={{ flex: "0 0 auto", marginTop: 7 }}>
                <h3>TODAY&apos;S CHECKLIST</h3>
                <div className="tt-checklist">
                  {CHECKLIST_ITEMS.map((it) => (
                    <label key={it}>
                      <input
                        type="checkbox"
                        checked={!!checklist[it]}
                        onChange={(e) => toggleCheck(it, e.target.checked)}
                      />
                      {it}
                    </label>
                  ))}
                </div>
              </div>
              <div className="tt-rememberBox">
                REMEMBER<br />
                CONSISTENCY + DISCIPLINE + PATIENCE<br />
                =<br />
                🏆 SUCCESS
              </div>
            </div>
          </div>

          <div className="tt-footerQuote">
            FOCUS ON YOUR GOAL. DON&apos;T LOOK IN ANY DIRECTION BUT AHEAD. &nbsp;|&nbsp; YOUR HARD WORK WILL DEFINITELY PAY OFF. ★ ★ ★
          </div>
        </div>
      </div>

      {/* EXTEND POPUP */}
      {extendFor && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 55 }}
            onClick={() => setExtendFor(null)}
          />
          <div className="tt-extPopup" style={{ left: extendFor.x, top: extendFor.y }}>
            {[15, 30, 45, 60].map((m) => (
              <button
                key={m}
                onClick={() => { extendSession(extendFor.id, m); setExtendFor(null); }}
              >
                +{m} min
              </button>
            ))}
            <button
              onClick={() => {
                const v = window.prompt("Custom minutes:");
                if (v) {
                  const n = parseInt(v, 10);
                  if (!Number.isNaN(n)) extendSession(extendFor.id, n);
                }
                setExtendFor(null);
              }}
            >
              Custom…
            </button>
          </div>
        </>
      )}
    </div>
  );
}
