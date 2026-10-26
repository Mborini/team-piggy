"use client";
import "./game.css";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { GAME_NAME, QUESTIONS, SECONDS_PER_QUESTION as T, TEACHER, TEAMS } from "./questions";
import { playCorrect, playFinish, playTick, playWrong, unlockAudio } from "./sound";

const SCHOOL = "أكاديمية ومدارس المجددون الدولية";

type Phase = "intro" | "play" | "end";
const LETTERS = ["أ", "ب", "ج", "د"];
const DEFAULT_NAMES = ["الفريق الأول", "الفريق الثاني", "الفريق الثالث", "الفريق الرابع"];
const COLORS = ["#ff5a63", "#4c9bff", "#ffb02e", "#2dd4bf"];
const TOTAL = QUESTIONS.length;
const ROUNDS = TOTAL / TEAMS;
const RING = 2 * Math.PI * 44;
const tc = (k: number) => ({ "--tc": COLORS[k] }) as CSSProperties;

// خلط عشوائي (Fisher-Yates) لترتيب الخيارات
const shuffle = (a: number[]) => {
  const r = [...a];
  for (let x = r.length - 1; x > 0; x--) {
    const y = Math.floor(Math.random() * (x + 1));
    [r[x], r[y]] = [r[y], r[x]];
  }
  return r;
};
const identity = () => QUESTIONS.map(() => [0, 1, 2, 3]);
const freshOrder = () => QUESTIONS.map(() => shuffle([0, 1, 2, 3]));

function Crest({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 80 92" width={size} height={size * 1.15} aria-hidden="true">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3d58a" />
          <stop offset="1" stopColor="#b98a2e" />
        </linearGradient>
      </defs>
      <path d="M40 3 74 15v31c0 22-14 36-34 43C20 82 6 68 6 46V15Z" fill="#0c1b4d" stroke="url(#cg)" strokeWidth="3.5" />
      <path d="M40 11 67 20v26c0 17-11 29-27 35-16-6-27-18-27-35V20Z" fill="none" stroke="url(#cg)" strokeWidth="1.2" opacity=".6" />
      <circle cx="37" cy="40" r="14" fill="rgba(191,227,255,.1)" stroke="#bfe3ff" strokeWidth="3.5" />
      <path d="M30 36a8 8 0 0 1 6-5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".8" />
      <path d="m47 50 12 12" stroke="#e23a48" strokeWidth="6" strokeLinecap="round" />
      <path d="m40 18 1.8 3.8 4.2.6-3 3 .7 4.2-3.7-2-3.7 2 .7-4.2-3-3 4.2-.6Z" fill="url(#cg)" transform="translate(0 -6) scale(1)" />
    </svg>
  );
}

export default function Game() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES);
  const [order, setOrder] = useState<number[][]>(identity);
  const [i, setI] = useState(0);
  const [scores, setScores] = useState<number[]>(Array(TEAMS).fill(0));
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [left, setLeft] = useState(T);
  const [paused, setPaused] = useState(false);

  const team = i % TEAMS;
  const round = Math.floor(i / TEAMS) + 1;
  const qi = Math.min(i, TOTAL - 1);
  const q = QUESTIONS[qi];
  const ord = order[qi];
  const shown = ord.map((idx) => q.options[idx]); // الخيارات بعد الخلط
  const correct = ord.indexOf(q.answer); // مكان الإجابة الصحيحة بعد الخلط
  const teamName = (k: number) => names[k].trim() || DEFAULT_NAMES[k];

  const start = () => {
    unlockAudio();
    setOrder(freshOrder());
    setScores(Array(TEAMS).fill(0)); setI(0); setLeft(T);
    setRevealed(false); setPicked(null); setPaused(false); setPhase("play");
  };

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  };

  const next = useCallback(() => {
    if (i >= TOTAL - 1) { setPhase("end"); playFinish(); return; }
    setI(i + 1); setRevealed(false); setPicked(null); setLeft(T); setPaused(false);
  }, [i]);

  const reveal = useCallback((choice: number | null) => {
    if (revealed) return;
    setRevealed(true); setPicked(choice);
    if (choice === correct) {
      setScores((s) => s.map((v, k) => (k === team ? v + 1 : v)));
      playCorrect();
    } else playWrong();
  }, [revealed, correct, team]);

  // العدّاد
  useEffect(() => {
    if (phase !== "play" || revealed || paused) return;
    const id = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(id);
  }, [phase, revealed, paused, i]);

  useEffect(() => {
    if (phase !== "play" || revealed) return;
    if (left <= 0) reveal(null);
    else if (left <= 5) playTick();
  }, [left, phase, revealed, reveal]);

  // اختصارات: 1-4 للاختيار، المسافة للإيقاف المؤقت أو السؤال التالي
  useEffect(() => {
    if (phase !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (!revealed && !paused && ["1", "2", "3", "4"].includes(e.key)) reveal(Number(e.key) - 1);
      if (e.code === "Space") { e.preventDefault(); revealed ? next() : setPaused((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, revealed, paused, reveal, next]);

  const header = (
    <header className="masthead">
      <div className="school">
        <Crest />
        <div className="school-txt">
          <h1>{SCHOOL}</h1>
          <div className="rule"><i /><span>{GAME_NAME}</span><i /></div>
        </div>
      </div>
      <div className="meta">
        <div className="teacher"><small>إعداد</small><b>{TEACHER}</b></div>
        <button className="icon" onClick={fullscreen} aria-label="ملء الشاشة" title="ملء الشاشة">⛶</button>
      </div>
    </header>
  );

  if (phase === "intro") {
    return (
      <main className="shell">
        {header}
        <section className="stage">
          <p className="kicker">مسابقة المجموعات</p>
          <h2>{GAME_NAME}</h2>
          <ul className="facts">
            <li><b>{TEAMS}</b><span>فرق</span></li>
            <li><b>{TOTAL}</b><span>سؤالًا</span></li>
            <li><b>{ROUNDS}</b><span>جولات</span></li>
            <li><b>{T}</b><span>ثانية للسؤال</span></li>
          </ul>
        </section>
        <section className="glass setup">
          <h3>أسماء الفرق</h3>
          <div className="names">
            {names.map((n, k) => (
              <label key={k} style={tc(k)}>
                <span>الفريق {LETTERS[k]}</span>
                <input value={n} maxLength={18} onChange={(e) => setNames(names.map((x, j) => (j === k ? e.target.value : x)))} />
              </label>
            ))}
          </div>
          <button className="cta" onClick={start}>ابدأ المسابقة</button>
          <p className="hint">اضغط على إجابة الفريق، أو استخدم المفاتيح 1 إلى 4. المسافة توقف العدّاد مؤقتًا، وبعد كشف الإجابة تنقلك للسؤال التالي.</p>
        </section>
      </main>
    );
  }

  if (phase === "end") {
    const rank = scores.map((s, k) => ({ k, s })).sort((a, b) => b.s - a.s);
    const top = rank[0].s;
    const winners = rank.filter((o) => o.s === top).map((o) => teamName(o.k));
    return (
      <main className="shell">
        {header}
        <section className="stage end">
          <p className="kicker">{winners.length > 1 ? "تعادل بين" : "الفريق الفائز"}</p>
          <h2>{winners.join(" و ")}</h2>
          <p className="congrats">تهنئة من {SCHOOL}</p>
        </section>
        <section className="glass setup">
          <ol className="rank">
            {rank.map((o, r) => (
              <li key={o.k} style={tc(o.k)} className={o.s === top ? "win" : ""}>
                <b>{r + 1}</b><span>{teamName(o.k)}</span><em>{o.s} / {ROUNDS}</em>
              </li>
            ))}
          </ol>
          <div className="row">
            <button className="cta" onClick={start}>مسابقة جديدة</button>
            <button className="ghost" onClick={() => setPhase("intro")}>تغيير الفرق</button>
          </div>
        </section>
      </main>
    );
  }

  const urgent = left <= 10;
  const good = picked === correct;
  const verdict = !revealed ? null : picked === null ? "انتهى الوقت" : good ? "إجابة صحيحة، نقطة للفريق" : "إجابة خاطئة";

  return (
    <main className="shell">
      {header}
      <section className="board" aria-label="النتائج">
        {names.map((_, k) => (
          <div key={k} style={tc(k)} className={`score ${k === team ? "active" : ""}`}>
            <span>{teamName(k)}</span><strong>{scores[k]}</strong>
          </div>
        ))}
      </section>
      <div className="progress" aria-label={`السؤال ${i + 1} من ${TOTAL}`}>
        {QUESTIONS.map((_, k) => <i key={k} className={k < i ? "done" : k === i ? "now" : ""} />)}
      </div>

      <section className="glass play" style={tc(team)}>
        <div className="turn">
          <div>
            <small>الجولة {round} من {ROUNDS} · السؤال {i + 1}</small>
            <h2>دور {teamName(team)}</h2>
          </div>
          <div className={`clock ${urgent ? "urgent" : ""}`} role="timer" aria-live="off">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" className="track" />
              <circle cx="50" cy="50" r="44" className="arc" strokeDasharray={RING} strokeDashoffset={RING * (1 - Math.max(left, 0) / T)} />
            </svg>
            <span>{Math.max(left, 0)}</span>
          </div>
        </div>

        <p className="question" key={i}>{q.q}</p>

        <div className="options">
          {shown.map((o, k) => {
            const cls = revealed ? (k === correct ? "ok" : k === picked ? "no" : "dim") : "";
            return (
              <button key={k} className={`opt ${cls}`} disabled={revealed || paused} onClick={() => reveal(k)}>
                <b>{LETTERS[k]}</b><span>{o}</span>
              </button>
            );
          })}
        </div>

        <div className={`verdict ${!revealed ? "" : good ? "good" : "bad"}`} aria-live="polite">
          {verdict ?? (paused ? "المسابقة متوقفة مؤقتًا" : "\u00a0")}
        </div>

        <div className="row">
          {!revealed && <button className="ghost" onClick={() => setPaused((p) => !p)}>{paused ? "متابعة" : "إيقاف مؤقت"}</button>}
          {revealed && <button className="cta" onClick={next}>{i >= TOTAL - 1 ? "عرض النتيجة" : "السؤال التالي"}</button>}
          <button className="ghost" onClick={() => { if (confirm("إنهاء المسابقة والعودة للبداية؟")) setPhase("intro"); }}>إنهاء</button>
        </div>
      </section>
    </main>
  );
}