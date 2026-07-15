import { createFileRoute } from "@tanstack/react-router";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { doc, onSnapshot, setDoc } from "firebase/firestore";

import { onAuthStateChanged, signInWithPopup, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

import { db, auth, googleProvider } from "../firebaseConfig";



export const Route = createFileRoute("/")({

  component: AppWrapper,

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



const CHECKLIST_ITEMS = ["Wake Up", "Exercise", "Breakfast", "Theory Completed", "Numericals Completed", "PYQs", "Aptitude", "Revision", "Sleep Before 10 PM"];



const ROW_CHECKLIST_MAP: Partial<Record<number, string>> = {

  0: "Wake Up", 1: "Exercise", 3: "Breakfast", 4: "Theory Completed", 6: "Numericals Completed", 8: "PYQs", 10: "Aptitude", 15: "Revision", 16: "Sleep Before 10 PM",

};



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

type SessionRec = { status: SessionStatus; remaining: number; endTs: number | null; warned: boolean; durationAllocated?: number; };

type CompletedLog = { date: string; rowId: number; cat: Row["cat"]; durMin: number; ts: number };



/* =============================================================

   HELPERS

   ============================================================= */

const todayKey = () => {

  const date = new Date();

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;

};



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

  ROWS.forEach((r) => { out[r.id] = { status: "notstarted", remaining: r.dur * 60, endTs: null, warned: false, durationAllocated: r.dur }; });

  return out;

}



function initChecklist(): Record<string, boolean> {

  const out: Record<string, boolean> = {};

  CHECKLIST_ITEMS.forEach((it) => (out[it] = false));

  return out;

}



/* =============================================================

   AUTHENTICATION WRAPPER

   ============================================================= */

function AppWrapper() {

  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");

  const [pass, setPass] = useState("");



  useEffect(() => {

    return onAuthStateChanged(auth, (currentUser) => {

      setUser(currentUser);

      setLoading(false);

    });

  }, []);



  if (loading) {

    return (

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f4f6f8', color: '#1f2870', fontFamily: 'sans-serif' }}>

        <h2>Connecting to Command Center...</h2>

      </div>

    );

  }



  if (!user) {

    return (

      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#1f2870', color: 'white', fontFamily: 'sans-serif' }}>

        <h1 style={{ fontSize: '48px', margin: '0 0 10px 0' }}>Officer Rohan's Timetable</h1>

        <p style={{ fontSize: '18px', opacity: 0.8, marginBottom: '30px' }}>Firebase Secured Architecture</p>

        

        {/* EMAIL & PASSWORD LOGIN BOX */}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '320px', marginBottom: '20px' }}>

          <input 

            type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} 

            style={{ padding: '14px', borderRadius: '8px', border: 'none', fontSize: '16px', outline: 'none' }} 

          />

          <input 

            type="password" placeholder="Password (min 6 chars)" value={pass} onChange={e => setPass(e.target.value)} 

            style={{ padding: '14px', borderRadius: '8px', border: 'none', fontSize: '16px', outline: 'none' }} 

          />

          <div style={{ display: 'flex', gap: '10px' }}>

            <button 

              onClick={() => signInWithEmailAndPassword(auth, email, pass).catch(e => alert("LOGIN ERROR: " + e.message))} 

              style={{ flex: 1, padding: '12px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>

              Login

            </button>

            <button 

              onClick={() => createUserWithEmailAndPassword(auth, email, pass).catch(e => alert("SIGNUP ERROR: " + e.message))} 

              style={{ flex: 1, padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>

              Sign Up

            </button>

          </div>

        </div>



        <div style={{ margin: '10px 0', opacity: 0.5, fontSize: '14px' }}>— OR —</div>



        {/* GOOGLE LOGIN FALLBACK */}

        <button 

          onClick={() => {

            signInWithPopup(auth, googleProvider).catch((error) => {

              alert("GOOGLE LOGIN ERROR: " + error.message);

            });

          }} 

          style={{ padding: '14px 32px', background: '#f0b429', color: '#111', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'transform 0.2s', marginTop: '10px' }}>

          Verify with Google

        </button>

      </div>

    );

  }



  return <StudyTimetable user={user} />;

}



/* =============================================================

   MAIN COMPONENT (FIREBASE POWERED)

   ============================================================= */

function StudyTimetable({ user }: { user: User }) {

  const [mounted, setMounted] = useState(false);

  const [nowTick, setNowTick] = useState(0);

  

  // State

  const [examDates, setExamDates] = useState(EXAMS_DEFAULT);

  const [sessions, setSessions] = useState<Record<number, SessionRec>>(initSessions);

  const [checklist, setChecklist] = useState<Record<string, boolean>>(initChecklist);

  const [pending, setPending] = useState<number[]>([]);

  const [heatmapLog, setHeatmapLog] = useState<Record<string, number>>({});

  const [completedLog, setCompletedLog] = useState<CompletedLog[]>([]);
  const [extensionLog, setExtensionLog] = useState<Array<{ date: string; rowId: number; activity: string; minutes: number; deductedFromRowId: number | null; deductedFrom: string | null; reopened: boolean; ts: number }>>([]);

  const [timeShift, setTimeShift] = useState(0);

  

  // UI State

  const [editingExam, setEditingExam] = useState<ExamKey | null>(null);

  const [extendModal, setExtendModal] = useState<{ id: number } | null>(null);

  const [extendMins, setExtendMins] = useState<number>(15);

  const [deductId, setDeductId] = useState<number | 'none'>('none');

  const [timerMinimized, setTimerMinimized] = useState(false);

  

  const ringRef = useRef<HTMLCanvasElement | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);



  // Firestore References

  const userRef = doc(db, "users", user.uid);

  const todayRef = doc(db, "users", user.uid, "daily", todayKey());



  /* -- FIREBASE REAL-TIME SYNC -- */

  useEffect(() => {

    // 1. Listen to Global User Data (Exams, Heatmap)

    const unsubUser = onSnapshot(userRef, (snap) => {

      if (snap.exists()) {

        const data = snap.data();

        if (data.examDates) setExamDates(data.examDates);

        if (data.heatmapLog) setHeatmapLog(data.heatmapLog);

      }

    });



    // 2. Listen to Today's Data (Sessions, Checklist, Timers)

    const unsubToday = onSnapshot(todayRef, (snap) => {

      if (snap.exists()) {

        const data = snap.data();

        if (data.sessions) setSessions(data.sessions);

        if (data.checklist) setChecklist(data.checklist);

        if (data.pending) setPending(data.pending);

        if (data.completedLog) setCompletedLog(data.completedLog);
        if (data.extensionLog) setExtensionLog(data.extensionLog);
        if (data.timeShift !== undefined) setTimeShift(data.timeShift);

      } else {

        // Initialize daily document if it doesn't exist

        setDoc(todayRef, { sessions: initSessions(), checklist: initChecklist(), pending: [], completedLog: [], timeShift: 0 }, { merge: true });

      }

      setMounted(true);

    });



    return () => { unsubUser(); unsubToday(); };

  }, [user.uid]);



  // Push updates to Firebase

  const updateToday = (updates: Partial<any>) => setDoc(todayRef, updates, { merge: true });

  const updateUserStats = (updates: Partial<any>) => setDoc(userRef, updates, { merge: true });



  /* -- sound -- */

  const playTone = useCallback((freq: number, duration: number, vol: number) => {

    try {

      if (!audioCtxRef.current) {

        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

        audioCtxRef.current = new AC();

      }

      const ctx = audioCtxRef.current;

      const osc = ctx.createOscillator();

      const gain = ctx.createGain();

      osc.type = "sine"; osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, ctx.currentTime);

      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.03);

      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain); gain.connect(ctx.destination);

      osc.start(); osc.stop(ctx.currentTime + duration + 0.02);

    } catch {}

  }, []);



  const playStartChime = useCallback(() => { playTone(523, 0.18, 0.12); setTimeout(() => playTone(659, 0.22, 0.12), 120); }, [playTone]);

  const playCompleteChime = useCallback(() => { playTone(659, 0.16, 0.12); setTimeout(() => playTone(880, 0.28, 0.12), 140); }, [playTone]);



  /* -- 1-second tick for local timers -- */

  useEffect(() => {

    const id = window.setInterval(() => setNowTick((x) => x + 1), 1000);

    return () => window.clearInterval(id);

  }, []);



  useEffect(() => {

    if (!mounted) return;

    const now = Date.now();

    let changed = false;

    const nextSessions = { ...sessions };

    const toComplete: number[] = [];

    ROWS.forEach((r) => {

      if (!isFocusRow(r)) return;

      const st = nextSessions[r.id];

      if (st && st.status === "running" && st.endTs) {

        const remaining = Math.round((st.endTs - now) / 1000);

        if (remaining <= 0) toComplete.push(r.id);

        else if (remaining !== st.remaining) { nextSessions[r.id] = { ...st, remaining }; changed = true; }

      }

    });

    if (changed) setSessions(nextSessions);

    toComplete.forEach((id) => completeSession(id));

  }, [nowTick, mounted]);



  useEffect(() => {

    if (!mounted) return;

    const check = () => {

      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

      const nextPending = [...pending];

      let pendingChanged = false;

      ROWS.forEach((r) => {

        if (!isFocusRow(r)) return;

        const st = sessions[r.id];

        const endMin = r.startMin + r.dur + timeShift;

        if (st && st.status === "notstarted" && nowMin > endMin && !nextPending.includes(r.id)) {

          nextPending.push(r.id);

          pendingChanged = true;

        }

      });

      if (pendingChanged) {

        setPending(nextPending);

        updateToday({ pending: nextPending });

      }

    };

    check();

    const id = window.setInterval(check, 60000);

    return () => window.clearInterval(id);

  }, [sessions, timeShift, mounted, pending]);



  const totalFocus = useMemo(() => ROWS.filter(isFocusRow).length, []);

  const doneToday = useMemo(() => completedLog.filter((l) => l.date === todayKey()), [completedLog]);

  const streak = useMemo(() => {

    let s = 0; const d = new Date();

    while (true) {

      const key = d.toISOString().slice(0, 10);

      if (heatmapLog[key] && heatmapLog[key] > 0) { s++; d.setDate(d.getDate() - 1); } else break;

    }

    return s;

  }, [heatmapLog]);

  

  // Live gradual progress: total allocated minutes vs. actual studied minutes
  // (completed sessions + elapsed portion of the currently running/paused session).
  const liveProgress = useMemo(() => {
    let allocated = 0;
    let studied = 0;
    ROWS.forEach((r) => {
      if (!isFocusRow(r)) return;
      const st = sessions[r.id];
      const alloc = st?.durationAllocated ?? r.dur;
      allocated += alloc;
      if (st?.status === "completed") {
        studied += alloc;
      } else if (st && (st.status === "running" || st.status === "paused")) {
        const elapsedSec = Math.max(0, alloc * 60 - Math.max(0, st.remaining));
        studied += elapsedSec / 60;
      }
    });
    return { allocated, studied, pct: allocated ? Math.min(1, studied / allocated) : 0 };
    // nowTick keeps this recomputing every second while a session runs
  }, [sessions, nowTick]);

  useEffect(() => {
    const cvs = ringRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const size = 84;
    cvs.width = size * dpr; cvs.height = size * dpr;
    cvs.style.width = size + "px"; cvs.style.height = size + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    const pct = liveProgress.pct;
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2, cy = size / 2, r = 34, lw = 12;
    ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.strokeStyle = "#e6e8f0";
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    if (pct > 0) {
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, "#f2c14e");
      grad.addColorStop(0.5, "#2b6fd6");
      grad.addColorStop(1, "#2a9d5c");
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      ctx.stroke();
    }
    ctx.fillStyle = "#1f2870"; ctx.font = "700 16px Oswald, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(Math.round(pct * 100) + "%", cx, cy);
  }, [liveProgress]);



  /* =========================================================

     ACTIONS (Pushing to Firebase)

     ========================================================= */

  const startSession = (id: number) => {

    const st = sessions[id];

    if (!st || st.status === "completed") return;

    

    const nextSessions = { ...sessions };

    // Pause any running session

    Object.keys(nextSessions).forEach(key => {

       if (nextSessions[Number(key)].status === 'running') {

         nextSessions[Number(key)].status = 'paused';

         nextSessions[Number(key)].endTs = null;

       }

    });



    nextSessions[id] = { ...st, status: "running", endTs: Date.now() + st.remaining * 1000, warned: false };

    

    playStartChime();

    setSessions(nextSessions);

    updateToday({ sessions: nextSessions, pending: pending.filter((x) => x !== id) });

  };



  const pauseSession = (id: number) => {

    const st = sessions[id];

    if (!st || st.status !== "running" || !st.endTs) return;

    

    const remaining = Math.round((st.endTs - Date.now()) / 1000);

    const nextSessions = { ...sessions, [id]: { ...st, status: "paused" as const, remaining, endTs: null } };

    

    setSessions(nextSessions);

    updateToday({ sessions: nextSessions });

  };



  const completeSession = (id: number) => {

    const row = ROWS.find((r) => r.id === id);

    if (!row) return;



    const nextSessions = { ...sessions, [id]: { ...sessions[id], status: "completed", remaining: 0, endTs: null } as SessionRec };

    const finalDur = sessions[id]?.durationAllocated ?? row.dur; 

    

    // Check if already completed to prevent duplicates

    let newLog = completedLog;

    if (!completedLog.some((l) => l.rowId === id && l.date === todayKey())) {

      newLog = [...completedLog, { date: todayKey(), rowId: id, cat: row.cat, durMin: finalDur, ts: Date.now() }];

    }

    

    const checklistItem = ROW_CHECKLIST_MAP[id];

    const newChecklist = checklistItem ? { ...checklist, [checklistItem]: true } : checklist;



    playCompleteChime();

    setSessions(nextSessions);

    updateToday({ sessions: nextSessions, completedLog: newLog, checklist: newChecklist, pending: pending.filter((x) => x !== id) });

    updateUserStats({ [`heatmapLog.${todayKey()}`]: (heatmapLog[todayKey()] || 0) + 1 });

    setTimerMinimized(false);

  };



  const extendSession = (id: number, minutes: number, targetDeductId: number | 'none') => {

    if (minutes <= 0) return;

    const st = sessions[id];

    const reopened = st.status === "completed";

    

    const nextSessions = { ...sessions };

    const remaining = (reopened ? 0 : st.remaining) + minutes * 60;

    const status = reopened ? "running" : st.status;

    const endTs = status === "running" ? Date.now() + remaining * 1000 : null;

    const oldAllocated = st.durationAllocated ?? (ROWS.find(r => r.id === id)?.dur || 0);



    nextSessions[id] = { ...st, status: status as SessionStatus, remaining, endTs, durationAllocated: oldAllocated + minutes, warned: false };

    let newShift = timeShift;



    if (targetDeductId !== 'none' && nextSessions[targetDeductId]) {

      const dst = nextSessions[targetDeductId];

      nextSessions[targetDeductId] = { ...dst, remaining: Math.max(0, dst.remaining - minutes * 60) };

    } else {

      newShift += minutes;

    }



    let newLog = completedLog;

    let newChecklist = checklist;

    

    if (reopened) {

       newLog = completedLog.filter(log => !(log.date === todayKey() && log.rowId === id));

       updateUserStats({ [`heatmapLog.${todayKey()}`]: Math.max((heatmapLog[todayKey()] || 1) - 1, 0) });

       

       const checklistItem = ROW_CHECKLIST_MAP[id];

       if (checklistItem) {

         newChecklist = { ...checklist, [checklistItem]: false };

       }

    }



    // Silently log this extension to Firebase for the email engine.
    const deductedFrom =
      targetDeductId !== 'none'
        ? ROWS.find((r) => r.id === targetDeductId)?.act || String(targetDeductId)
        : null;
    const extensionEntry = {
      date: todayKey(),
      rowId: id,
      activity: ROWS.find((r) => r.id === id)?.act || String(id),
      minutes,
      deductedFromRowId: targetDeductId === 'none' ? null : targetDeductId,
      deductedFrom,
      reopened,
      ts: Date.now(),
    };

    setSessions(nextSessions);
    updateToday({
      sessions: nextSessions,
      timeShift: newShift,
      completedLog: newLog,
      checklist: newChecklist,
      extensionLog: [...extensionLog, extensionEntry],
    });

  };



  const saveExamDate = (key: ExamKey, val: string) => {

    if (!val) return;

    const newExams = { ...examDates, [key]: { ...examDates[key], date: val } };

    setExamDates(newExams);

    setEditingExam(null);

    updateUserStats({ examDates: newExams });

  };



  const toggleCheck = (item: string, val: boolean) => {

    const newChecklist = { ...checklist, [item]: val };

    setChecklist(newChecklist);

    updateToday({ checklist: newChecklist });

  };



  /* =========================================================

     DERIVED VIEW STATE

     ========================================================= */

  const now = new Date();

  const hh = now.getHours();

  const greet = hh < 12 ? "Good Morning" : hh < 17 ? "Good Afternoon" : "Good Evening";

  const greetLine = mounted ? `${greet}, Officer Rohan — ${now.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}` : "Good Morning, Officer Rohan";

  const clockLine = mounted ? now.toLocaleTimeString("en-IN", { hour12: true }) : "--:--:--";

  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);

  const dailyQuote = QUOTES[dayOfYear % QUOTES.length];



  const displayedStart = (row: Row) => {

    if (!mounted) return row.time.split("–")[0].trim();

    const nowMin = now.getHours() * 60 + now.getMinutes();

    if (row.startMin > nowMin) return minsToClock(row.startMin + timeShift);

    return row.time.split("–")[0].trim();

  };



  const runningRow = ROWS.find((r) => isFocusRow(r) && sessions[r.id]?.status === "running") || null;

  const todayIdx = (now.getDay() + 6) % 7;



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

      <div className="tt-scaleWrap">

        <div className="tt-app">

          {/* EXAM STRIP */}

          <div className="tt-examStrip">

            {(["ssc", "gate", "ese"] as ExamKey[]).map((key) => {

              const e = examDates[key];

              const c = mounted ? countdownParts(e.date) : { d: 0, h: 0, m: 0, s: 0 };

              return (

                <div key={key} className={`tt-examBox ${key}`} onClick={() => setEditingExam((cur) => (cur === key ? null : key))}>

                  <div className="tt-num">

                    {mounted ? `${c.d}d : ${String(c.h).padStart(2, "0")}h : ${String(c.m).padStart(2, "0")}m : ${String(c.s).padStart(2, "0")}s` : "-- : -- : -- : --"}

                  </div>

                  <div className="tt-lbl">TO {e.label}</div>

                  <div className="tt-sub">target: {e.date} (tap to edit)</div>

                  {editingExam === key && (

                    <div className="tt-examEdit" onClick={(ev) => ev.stopPropagation()}>

                      <input type="date" defaultValue={e.date} onKeyDown={(ev) => { if (ev.key === "Enter") saveExamDate(key, (ev.target as HTMLInputElement).value); }} id={`edit_${key}`} />

                      <button onClick={() => { const el = document.getElementById(`edit_${key}`) as HTMLInputElement | null; if (el) saveExamDate(key, el.value); }}>Save</button>

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

                  <b className="blue">UPSC ESE (ELECTRICAL)</b> | <b className="red">MPSC</b> | <b className="green">SSC JE</b> | <b className="purple">RRB JE</b> | <b className="orange">SSC CGL</b> | <b className="blue">RAILWAYS</b>

                </div>

                <div className="tt-motto">★ ★ &nbsp; ONE DAY OR DAY ONE. YOU DECIDE. &nbsp; ★ ★</div>

              </div>

              <div style={{ width: 150 }}>

                <div className="tt-targetBlock">

                  🎯<br /><span className="t1">FOCUS</span><br /><span className="t2">DISCIPLINE</span><br /><span className="t3">SUCCESS</span>

                </div>

              </div>

            </div>



            <div className="tt-liveRow">

              <div className="tt-greet">{greetLine}</div>

              <div className="tt-clock">{clockLine}</div>

            </div>

            <div className="tt-quoteBar">&ldquo;{dailyQuote}&rdquo;</div>

            <div className="tt-syncIndicator" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', padding: '6px 12px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold' }}>

              <span className="tt-syncDot" aria-hidden="true" style={{ background: '#22c55e', width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' }} />

              <span>Firebase Database Synced ⚡ ({user.email})</span>

            </div>

          </div>



          {/* MAIN GRID */}

          <div className="tt-mainGrid">

            <div className="tt-leftCol">

              <table className="tt-table">

                <thead>

                  <tr>

                    <th style={{ width: "4%" }}></th><th style={{ width: "9%" }}>TIME</th><th style={{ width: "29%" }}>ACTIVITY</th><th style={{ width: "29%" }}>FOCUS / SUBJECT</th><th style={{ width: "8%" }}>STATUS</th><th style={{ width: "9%" }}>TIMER</th><th style={{ width: "12%" }}>ACTIONS</th>

                  </tr>

                </thead>

                <tbody>

                  {ROWS.map((r) => {

                    if (!isFocusRow(r)) {

                      return (

                        <tr key={r.id} className="tt-rowLIFE">

                          <td className="tt-rowIcon">{r.icon}</td><td>{displayedStart(r)}</td><td><b>{r.act}</b></td><td>{r.focus}</td><td colSpan={3} style={{ textAlign: "center", color: "#bbb" }}>— not a focus session —</td>

                        </tr>

                      );

                    }

                    const st = sessions[r.id];

                    const rowClass = st.status === "running" ? "tt-rowRUN" : st.status === "paused" ? "tt-rowPAUSE" : st.status === "completed" ? "tt-rowDONE" : "tt-rowNS";

                    const pillClass = "tt-st-" + st.status;

                    const pillLabel = st.status === "notstarted" ? "NOT STARTED" : st.status.toUpperCase();

                    const critical = st.status === "running" && st.remaining <= 5;

                    const anotherSessionRunning = Boolean(runningRow && runningRow.id !== r.id);

                    const disableStart = st.status === "running" || st.status === "completed" || anotherSessionRunning;

                    const disablePause = st.status !== "running";

                    const disableDone = st.status === "completed" || st.status === "notstarted" || st.remaining > 10 * 60;

                    const canExtend = st.status === "completed" || st.remaining <= 600;



                    return (

                      <tr key={r.id} className={rowClass}>

                        <td className="tt-rowIcon">{r.icon}</td>

                        <td>{displayedStart(r)}</td>

                        <td><b>{r.act}</b></td>

                        <td>{r.focus}</td>

                        <td><span className={`tt-statusPill ${pillClass}`}>{pillLabel}</span></td>

                        <td className={`tt-rowTimer ${critical ? "critical" : ""}`}>{fmtTime(st.remaining)}</td>

                        <td className="tt-actBtns">

                          <button className="tt-b-start" disabled={disableStart} onClick={() => startSession(r.id)}>▶</button>

                          <button className="tt-b-pause" disabled={disablePause} onClick={() => pauseSession(r.id)}>⏸</button>

                          <button className="tt-b-ext" disabled={!canExtend} onClick={() => setExtendModal({ id: r.id })}>➕</button>

                          <button className="tt-b-done" disabled={disableDone} onClick={() => completeSession(r.id)}>✓</button>

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

                <div className="tt-col">

                  <div className="tt-card">

                    <h3>SUBJECT FOCUS (WEEKLY ROTATION)</h3>

                    <div className="tt-cardBody">

                      <table className="tt-rotationTable">

                        <tbody>

                          {ROTATION.map(([day, subj], i) => (

                            <tr key={day} className={i === todayIdx ? "today" : ""}><td><b>{day}</b></td><td>{subj}</td></tr>

                          ))}

                        </tbody>

                      </table>

                    </div>

                  </div>

                  <div className="tt-card tt-analyticsCard">

                    <h3>ANALYTICS OVERVIEW</h3>

                    <div className="tt-analyticsGrid">

                      {analytics.cells.map(([l, v]) => (

                        <div key={l}><b>{v}</b>{l}</div>

                      ))}

                    </div>

                  </div>

                </div>



                <div className="tt-col">

                  <div className="tt-card">

                    <h3>EXAM COVERAGE</h3>

                    <div className="tt-cardBody">

                      <ul className="tt-examCoverage">

                        <li>UPSC ESE (Electrical)</li><li>MPSC Engineering Services</li><li>SSC JE</li><li>RRB JE / SSE</li><li>SSC CGL / CHSL / MTS</li><li>SSC GD</li><li>Railways NTPC / Group D</li>

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

                </div>



                <div className="tt-col">

                  <div className="tt-card">

                    <h3>GOLDEN RULES</h3>

                    <div className="tt-cardBody">

                      <ul className="tt-goldenRules">

                        <li>Be Consistent</li><li>Follow the Plan</li><li>Avoid Distractions</li><li>Revise Regularly</li><li>Take Mock Tests</li><li>Analyze &amp; Improve</li><li>Believe in Yourself</li>

                      </ul>

                    </div>

                  </div>

                  <div className="tt-card tt-emailCard">

                    <h3>FIREBASE ENGINE SECURED 🛡️</h3>

                    <p>Google Auth + Email Password is enabled. Data is locked to your account and streams instantly in real-time across all your devices.</p>

                  </div>

                </div>



                <div className="tt-col tt-motivPanel">

                  <div className="tt-card" style={{ flex: "0 0 auto" }}>

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

                        Less <span className="tt-hcell" /> <span className="tt-hcell l1" /> <span className="tt-hcell l2" /> <span className="tt-hcell l3" /> <span className="tt-hcell l4" /> More

                      </div>

                    </div>

                  </div>

                  <div className="tt-card" style={{ flex: "0 0 auto" }}>

                    <h3>TODAY&apos;S CHECKLIST</h3>

                    <div className="tt-checklist">

                      {CHECKLIST_ITEMS.map((it) => (

                        <label key={it}><input type="checkbox" checked={!!checklist[it]} onChange={(e) => toggleCheck(it, e.target.checked)} />{it}</label>

                      ))}

                    </div>

                  </div>

                  <div className="tt-rememberBox">REMEMBER<br />CONSISTENCY + DISCIPLINE + PATIENCE<br />=<br />🏆 SUCCESS</div>

                </div>

              </div>

            </div>

          </div>

          <div className="tt-footerQuote">FOCUS ON YOUR GOAL. DON&apos;T LOOK IN ANY DIRECTION BUT AHEAD. &nbsp;|&nbsp; YOUR HARD WORK WILL DEFINITELY PAY OFF. ★ ★ ★</div>

        </div>

      </div>



      {/* EXTENSION MODAL — glass-morphism */}
      {extendModal && (() => {
        const row = ROWS.find(r => r.id === extendModal.id);
        const trades = ROWS.filter(r => isFocusRow(r) && r.id !== extendModal.id && sessions[r.id]?.status !== "completed" && sessions[r.id]?.remaining >= extendMins * 60);
        return (
          <div className="tt-glassOverlay" onClick={() => setExtendModal(null)}>
            <div className="tt-glassBox" onClick={(e) => e.stopPropagation()}>
              <div className="tt-glassHead">
                <div className="tt-glassIcon">{row?.icon || "⏱"}</div>
                <div>
                  <div className="tt-glassEyebrow">Extend Session</div>
                  <div className="tt-glassTitle">{row?.act}</div>
                </div>
                <button className="tt-glassClose" onClick={() => setExtendModal(null)} aria-label="Close">×</button>
              </div>

              <div className="tt-glassSection">
                <div className="tt-glassLabel">Add extra minutes</div>
                <div className="tt-glassChips">
                  {[15, 30, 45, 60].map(m => (
                    <button key={m} className={`tt-glassChip ${extendMins === m ? "active" : ""}`} onClick={() => setExtendMins(m)}>+{m}m</button>
                  ))}
                </div>
                <div className="tt-glassStepper">
                  <button onClick={() => setExtendMins(Math.max(1, extendMins - 5))} aria-label="Decrease">−</button>
                  <div className="tt-glassStepperValue"><span>{extendMins}</span><small>min</small></div>
                  <button onClick={() => setExtendMins(extendMins + 5)} aria-label="Increase">+</button>
                </div>
              </div>

              <div className="tt-glassSection">
                <div className="tt-glassLabel">Trade time from another session <span className="tt-glassOptional">(optional)</span></div>
                <select className="tt-glassSelect" value={deductId} onChange={(e) => setDeductId(e.target.value === "none" ? "none" : Number(e.target.value))}>
                  <option value="none">— Add on top (no trade) —</option>
                  {trades.map(r => (
                    <option key={r.id} value={r.id}>{r.icon} {r.act} ({Math.floor(sessions[r.id].remaining / 60)}m available)</option>
                  ))}
                </select>
                <div className="tt-glassHint">
                  {deductId === 'none'
                    ? "This will push your schedule forward by " + extendMins + " min."
                    : "Time will be traded silently — logged for the mission report."}
                </div>
              </div>

              <div className="tt-glassActions">
                <button className="tt-glassBtn ghost" onClick={() => setExtendModal(null)}>Cancel</button>
                <button className="tt-glassBtn primary" onClick={() => { extendSession(extendModal.id, extendMins, deductId); setExtendModal(null); setDeductId('none'); }}>
                  Confirm +{extendMins}m
                </button>
              </div>
            </div>
          </div>
        );
      })()}



      {/* TIMER LOGIC */}

      {(() => {

        const active = runningRow || ROWS.find((r) => isFocusRow(r) && sessions[r.id]?.status === "paused" && sessions[r.id]?.remaining < r.dur * 60);

        if (!active) return null;



        const st = sessions[active.id];

        const done = st.remaining <= 0;

        const critical = st.status === "running" && st.remaining <= 10 && st.remaining > 0;

        const canExtend = st.status === "completed" || st.remaining <= 600;



        if (timerMinimized) {

          return (

            <div className="tt-timerMini" onClick={() => setTimerMinimized(false)} title="Click to open full timer">

              <span className="tt-tmIcon">{active.icon}</span>

              <span className="tt-tmSubj">{active.act}</span>

              <div className="tt-tmBigSolid">

                {fmtTime(st.remaining)}

              </div>

            </div>

          );

        }



        return (

          <div className={`tt-timerModal ${done ? "done" : ""} ${critical ? "warn" : ""}`}>

            <div className="tt-tmHead">

              <div>

                <span className="tt-tmIcon">{active.icon}</span>

                <span className="tt-tmTitle">{active.act}</span>

                <span className={`tt-statusPill tt-st-${st.status}`}>

                  {st.status === "notstarted" ? "NOT STARTED" : st.status.toUpperCase()}

                </span>

              </div>

              <button className="tt-tmCloseBtn" onClick={() => setTimerMinimized(true)}>

                🔽 Minimize

              </button>

            </div>

            <div className="tt-tmBig">{fmtTime(st.remaining)}</div>

            <div className="tt-tmHint">

              {done ? "✅ Time complete — you may Complete or Extend." : "Complete and Extension unlock in the final 10 minutes."}

            </div>

            <div className="tt-tmBtns">

              {st.status === "running" ? (

                <button className="tt-b-pause" onClick={() => pauseSession(active.id)}>⏸ Pause</button>

              ) : (

                <button className="tt-b-start" onClick={() => startSession(active.id)}>▶ Resume</button>

              )}

              <button className="tt-b-ext" disabled={!canExtend} onClick={() => setExtendModal({ id: active.id })}>➕ Extend</button>

              <button className="tt-b-done" disabled={st.remaining > 10 * 60} onClick={() => completeSession(active.id)}>✓ Complete</button>

            </div>

          </div>

        );

      })()}

      

      {/* CSS */}

      <style>{`

        .tt-modalOverlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 9999; display: flex; justify-content: center; align-items: center; padding: 15px; }

        .tt-modalBox { background: white; width: 100%; max-width: 420px; border-radius: 16px; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }

        .tt-modalBox h3 { margin-top: 0; color: #1f2870; font-size: 20px; font-weight: 800; margin-bottom: 16px; }

        .tt-modalBox label { display: block; font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #4b5563; }

        .tt-modalBox select, .tt-modalBox input { width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; outline: none; }

        .tt-modalBox select:focus, .tt-modalBox input:focus { border-color: #1f2870; }

        .tt-extBtnGroup { display: flex; gap: 8px; margin-bottom: 12px; }

        .tt-extBtnGroup button { flex: 1; padding: 8px 0; font-size: 14px; font-weight: 600; background: #f3f4f6; color: #4b5563; border: 2px solid transparent; border-radius: 8px; cursor: pointer; transition: 0.2s; }

        .tt-extBtnGroup button.active { background: #e0e7ff; color: #1f2870; border-color: #1f2870; }

        .tt-modalActions { display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end; }

        .tt-modalActions button { padding: 10px 20px; border-radius: 8px; font-weight: bold; font-size: 14px; border: none; cursor: pointer; }



        .tt-timerMini { position: fixed; top: 15px; left: 50%; transform: translateX(-50%); background: #1f2870; color: white; padding: 10px 30px; border-radius: 50px; display: flex; align-items: center; gap: 15px; box-shadow: 0 8px 20px rgba(0,0,0,0.3); z-index: 9998; cursor: pointer; border: 2px solid #f0b429; transition: transform 0.2s; }

        .tt-timerMini:active { transform: translateX(-50%) scale(0.95); }

        .tt-timerMini .tt-tmIcon { font-size: 20px; }

        .tt-timerMini .tt-tmSubj { font-size: 16px; font-weight: 600; color: #fcd34d; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .tt-tmBigSolid { background: #ea580c; color: #ffffff; padding: 6px 14px; border-radius: 8px; font-size: 22px; font-weight: 900; font-family: monospace; letter-spacing: 1px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); margin-left: 10px; }

        .tt-tmCloseBtn { background: #e5e7eb; color: #4b5563; border: none; padding: 6px 12px; border-radius: 12px; font-size: 13px; font-weight: bold; cursor: pointer; transition: background 0.2s; }

        .tt-tmCloseBtn:hover { background: #d1d5db; color: #111; }

        .tt-tmHead { display: flex; justify-content: space-between; align-items: center; gap: 10px; width: 100%; }

        .tt-tmHead > div { display: flex; align-items: center; gap: 10px; }

      `}</style>

    </div>

  );

} 

