"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimation, useReducedMotion } from "framer-motion";

/* ───────────── الأنواع والثوابت ───────────── */
type Tier = "silver" | "bronze" | "gold";
type Member = { id: number; name: string; points: number };
type Entry = { memberId: number; tier: Tier };
type Status = "loading" | "saved" | "saving" | "error" | "offline";

const MUTE_KEY = "team-piggy-muted";
const MAX_VISIBLE_COINS = 100;
const DEFAULT_MEMBERS: Member[] = ["نائل", "Borini", "نايف", "خلايلة", "زياد", "مجدي"].map((name, i) => ({
  id: i + 1,
  name,
  points: 0,
}));

// value = قيمة الكوين بالقروش، from = أول نقطة في الفئة
const TIERS: Record<Tier, { label: string; value: number; from: number; main: string; light: string; dark: string; next?: { at: number; label: string } }> = {
  silver: { label: "فضي", value: 10, from: 0, main: "#9aa7b6", light: "#eef2f6", dark: "#5d6a79", next: { at: 16, label: "البرونز" } },
  bronze: { label: "برونز", value: 15, from: 16, main: "#b8733a", light: "#f0b988", dark: "#6e3d16", next: { at: 26, label: "الذهبي" } },
  gold: { label: "ذهبي", value: 20, from: 26, main: "#d4a02a", light: "#fbe28a", dark: "#7d5a07" },
};
// 0–15 فضي (10 قروش)، 16–25 برونز (15 قروش)، 26+ ذهبي (20 قرش)
const getTier = (p: number): Tier => (p >= 26 ? "gold" : p >= 16 ? "bronze" : "silver");
const dinar = (q: number) => (q / 100).toFixed(2); // 100 قرش = 1 دينار

/* ───────────── الألقاب والشخصيات ───────────── */
type Role = {
  title: string;
  skin: string;
  cloth: string;
  bg: [string, string];
  hat: "turban" | "fez" | "scarf" | "straw";
  hatColor: string;
  beard: "short" | "full" | "goatee" | "stubble" | "none";
  beardColor: string;
  mood: "smile" | "stern" | "smirk" | "grin" | "tired";
  extra?: "patch" | "freckles" | "sweat" | "carrot";
};

// علي بابا (الأول بالمصفوفة) يُعطى لصاحب أقل النقاط، والباقي حسب الترتيب من الأعلى نقاطاً. غيّر الألقاب من هنا فقط.
const ROLES: Role[] = [
  { title: "علي بابا", skin: "#e0ae83", cloth: "#1f7a6d", bg: ["#35a394", "#14574f"], hat: "turban", hatColor: "#f3ecd8", beard: "short", beardColor: "#5c4a3a", mood: "smile" },
  { title: "زعيم الحرامية", skin: "#c58a60", cloth: "#5a1220", bg: ["#a3243a", "#4a0f1a"], hat: "turban", hatColor: "#1a1722", beard: "full", beardColor: "#15110f", mood: "stern", extra: "patch" },
  { title: "مساعد الزعيم", skin: "#cf9970", cloth: "#4b2d6e", bg: ["#7447ad", "#33194f"], hat: "turban", hatColor: "#6a2f8f", beard: "goatee", beardColor: "#1f1a22", mood: "smirk" },
  { title: "صبي الزعيم", skin: "#e8bd94", cloth: "#c0432f", bg: ["#e09a35", "#8a4d0f"], hat: "fez", hatColor: "#b3262a", beard: "none", beardColor: "#000", mood: "grin", extra: "freckles" },
  { title: "خادم الزعيم", skin: "#c9946d", cloth: "#6e6a60", bg: ["#8795a3", "#3e4650"], hat: "scarf", hatColor: "#9aa393", beard: "none", beardColor: "#000", mood: "tired", extra: "sweat" },
  { title: "سائس الحمار", skin: "#d8a77a", cloth: "#7a5a2c", bg: ["#7fa23f", "#3a4f1c"], hat: "straw", hatColor: "#e3c56a", beard: "stubble", beardColor: "#4a3a2a", mood: "smile", extra: "carrot" },
];

// الأخير (أقل نقاط) = علي بابا (ROLES[0])، وباقي الترتيب من الأعلى يأخذ الألقاب 1..5
const roleIndex = (rank: number, total: number) => (rank === total - 1 ? 0 : rank + 1);

// الترتيب: الأعلى نقاطاً أولاً. عند التعادل: من وصل للنقاط أولاً يتقدّم.
function rankMembers(members: Member[], history: Entry[]): Member[] {
  const last: Record<number, number> = {};
  history.forEach((h, i) => {
    last[h.memberId] = i;
  });
  return [...members].sort((a, b) => b.points - a.points || (last[a.id] ?? -1) - (last[b.id] ?? -1) || a.id - b.id);
}

/* ───────────── الصوت ───────────── */
function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  const tone = useCallback((freqs: number[], type: OscillatorType, dur: number, vol: number) => {
    if (mutedRef.current) return;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!ctxRef.current) ctxRef.current = new AC();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      freqs.forEach((f, i) => osc.frequency.setValueAtTime(f, t0 + (i * dur) / freqs.length));
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {}
  }, []);

  return {
    muted,
    setMuted,
    coin: useCallback(() => tone([988, 1319], "square", 0.28, 0.06), [tone]),
    undo: useCallback(() => tone([392, 262], "triangle", 0.22, 0.12), [tone]),
  };
}

/* ───────────── عدّاد متحرك ───────────── */
function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min((now - start) / 450, 1);
      setShown(Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown}</>;
}

/* ───────────── الأفاتار ───────────── */
function Avatar({ role, size = 64 }: { role: number; size?: number }) {
  const r = ROLES[role];
  const id = `av${role}`;
  const hasBeard = r.beard === "short" || r.beard === "full" || r.beard === "goatee";
  const brow = r.beard === "none" || r.beard === "stubble" ? "#3b2a1c" : r.beardColor;
  const mouth = hasBeard ? "#e9b9a0" : "#7a2e22";

  const browPaths: Record<Role["mood"], [string, string]> = {
    smile: ["M36 44 Q41 41 47 44", "M53 44 Q59 41 64 44"],
    grin: ["M36 44 Q41 41 47 44", "M53 44 Q59 41 64 44"],
    stern: ["M36 41 L47 45", "M64 41 L53 45"],
    smirk: ["M36 44 Q41 42 47 44", "M53 41 Q59 38 64 43"],
    tired: ["M36 46 Q41 44 47 45", "M53 45 Q59 44 64 46"],
  };
  const mouthPaths: Record<Role["mood"], string> = {
    smile: "M43 64 Q50 70 57 64",
    stern: "M44 66 H56",
    smirk: "M44 66 Q51 68 58 63",
    grin: "M42 63 Q50 74 58 63 Z",
    tired: "M44 67 Q50 64 56 67",
  };

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={r.title}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={r.bg[0]} />
          <stop offset="1" stopColor={r.bg[1]} />
        </linearGradient>
        <clipPath id={`${id}-c`}>
          <circle cx="50" cy="50" r="48" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-c)`}>
        <rect width="100" height="100" fill={`url(#${id}-bg)`} />
        {/* العنق والثياب */}
        <rect x="43" y="64" width="14" height="14" fill={r.skin} />
        <path d="M8 100 Q12 76 50 73 Q88 76 92 100 Z" fill={r.cloth} />
        <path d="M38 74 L50 90 L62 74" fill="none" stroke="#e3b94d" strokeWidth="2.2" />
        {/* الأذنان والرأس */}
        <circle cx="29" cy="53" r="4.5" fill={r.skin} />
        <circle cx="71" cy="53" r="4.5" fill={r.skin} />
        <ellipse cx="50" cy="50" rx="21" ry="24" fill={r.skin} />
        <circle cx="36" cy="58" r="4" fill="rgba(220,90,70,.18)" />
        <circle cx="64" cy="58" r="4" fill="rgba(220,90,70,.18)" />
        {r.extra === "freckles" && (
          <g fill="#b9724a">
            <circle cx="35" cy="57" r=".9" /><circle cx="39" cy="59" r=".9" /><circle cx="37" cy="61" r=".9" />
            <circle cx="65" cy="57" r=".9" /><circle cx="61" cy="59" r=".9" /><circle cx="63" cy="61" r=".9" />
          </g>
        )}
        {/* العينان والحاجبان والأنف */}
        {[42, 58].map((cx) => (
          <g key={cx}>
            <ellipse cx={cx} cy="50" rx="4.2" ry={r.mood === "tired" ? 2.4 : 3.2} fill="#fff" />
            <circle cx={cx} cy={r.mood === "tired" ? 50.6 : 50} r="2" fill="#1c1512" />
          </g>
        ))}
        <path d={browPaths[r.mood][0]} fill="none" stroke={brow} strokeWidth="2.2" strokeLinecap="round" />
        <path d={browPaths[r.mood][1]} fill="none" stroke={brow} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M50 52 Q47 59 51 60" fill="none" stroke="rgba(90,50,20,.45)" strokeWidth="1.6" strokeLinecap="round" />
        {/* اللحية */}
        {r.beard === "short" && (
          <>
            <path d="M30 54 Q32 72 50 74 Q68 72 70 54 Q66 62 50 63 Q34 62 30 54 Z" fill={r.beardColor} />
            <path d="M40 60 Q50 56 60 60 Q50 63 40 60 Z" fill={r.beardColor} />
          </>
        )}
        {r.beard === "full" && (
          <>
            <path d="M28 50 Q26 86 50 90 Q74 86 72 50 Q66 70 50 70 Q34 70 28 50 Z" fill={r.beardColor} />
            <path d="M37 61 Q50 54 63 61 Q50 65 37 61 Z" fill={r.beardColor} />
          </>
        )}
        {r.beard === "goatee" && (
          <>
            <path d="M44 66 Q50 84 56 66 Q50 70 44 66 Z" fill={r.beardColor} />
            <path d="M38 60 Q44 56 50 60 Q56 56 62 60 Q56 64 50 62 Q44 64 38 60 Z" fill={r.beardColor} />
          </>
        )}
        {r.beard === "stubble" && <path d="M30 56 Q32 72 50 74 Q68 72 70 56 Q66 66 50 67 Q34 66 30 56 Z" fill={r.beardColor} opacity=".28" />}
        {/* الفم */}
        <path d={mouthPaths[r.mood]} fill={r.mood === "grin" ? "#fff" : "none"} stroke={mouth} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* تفاصيل خاصة */}
        {r.extra === "patch" && (
          <>
            <path d="M28 46 L72 40" stroke="#121018" strokeWidth="1.8" />
            <ellipse cx="42" cy="50" rx="6.5" ry="5.5" fill="#121018" />
            <path d="M62 44 L57 60" stroke="#8a3b2c" strokeWidth="1.4" strokeLinecap="round" />
          </>
        )}
        {r.extra === "sweat" && <path d="M76 36 Q80 44 76 48 Q72 44 76 36 Z" fill="#8fd3ff" />}
        {r.extra === "carrot" && (
          <>
            <path d="M58 65 L86 60 L60 70 Z" fill="#f08a1c" />
            <path d="M86 60 L92 55 M86 60 L93 61" stroke="#4f9a2f" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
        {/* غطاء الرأس */}
        {r.hat === "turban" && (
          <>
            <ellipse cx="50" cy="15" rx="10" ry="7" fill={r.hatColor} />
            <path d="M26 40 C24 12 76 12 74 40 C62 32 38 32 26 40 Z" fill={r.hatColor} />
            <path d="M29 31 Q50 21 71 31 M27 36 Q50 27 73 36" fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="1.6" />
            <circle cx="50" cy="27" r="3.2" fill="#e3b94d" stroke="#8f6a1c" strokeWidth=".8" />
          </>
        )}
        {r.hat === "fez" && (
          <>
            <path d="M33 38 L37 14 Q50 8 63 14 L67 38 Z" fill={r.hatColor} />
            <rect x="33" y="34" width="34" height="4" fill="#e3b94d" />
            <path d="M63 14 Q80 14 78 33" fill="none" stroke="#e3b94d" strokeWidth="2" />
            <circle cx="78" cy="35" r="3" fill="#e3b94d" />
          </>
        )}
        {r.hat === "scarf" && (
          <>
            <path d="M25 42 Q24 16 50 15 Q76 16 75 42 Q74 32 50 30 Q26 32 25 42 Z" fill={r.hatColor} />
            <ellipse cx="73" cy="38" rx="6" ry="4.5" fill={r.hatColor} stroke="rgba(0,0,0,.25)" />
          </>
        )}
        {r.hat === "straw" && (
          <>
            <ellipse cx="50" cy="34" rx="34" ry="8" fill={r.hatColor} stroke="#9a7a2c" strokeWidth="1.2" />
            <path d="M35 34 Q35 12 50 12 Q65 12 65 34 Z" fill={r.hatColor} stroke="#9a7a2c" strokeWidth="1.2" />
            <path d="M35 30 Q50 34 65 30" fill="none" stroke="#b3262a" strokeWidth="3.4" />
          </>
        )}
      </g>
      <circle cx="50" cy="50" r="48" fill="none" stroke="#e3b94d" strokeWidth="3" />
    </svg>
  );
}

/* ───────────── خلفية الكهف ───────────── */
function CaveBackdrop() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 500 640" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="cave" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d0c2b" />
          <stop offset="1" stopColor="#2a1b4d" />
        </linearGradient>
        <radialGradient id="treasure" cx="50%" cy="100%" r="60%">
          <stop offset="0" stopColor="#ffd25a" stopOpacity=".55" />
          <stop offset="1" stopColor="#ffd25a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="500" height="640" fill="#1c1747" />
      <g fill="#f3d98a">
        {[[60, 40, 1.6], [150, 80, 1.1], [330, 36, 1.4], [440, 90, 1.8], [250, 20, 1], [400, 150, 1]].map(([x, y, s], i) => (
          <circle key={i} cx={x} cy={y} r={s} opacity=".8" />
        ))}
      </g>
      <path d="M52 70 a26 26 0 1 0 22 40 a20 20 0 1 1 -22 -40 Z" fill="#f3d98a" opacity=".9" />
      <path d="M40 640 L40 250 C40 120 130 60 250 40 C370 60 460 120 460 250 L460 640 Z" fill="url(#cave)" stroke="#e3b94d" strokeOpacity=".55" strokeWidth="3" />
      <path d="M62 640 L62 255 C62 138 142 84 250 66 C358 84 438 138 438 255 L438 640 Z" fill="none" stroke="#e3b94d" strokeOpacity=".25" strokeWidth="1.5" />
      <rect y="320" width="500" height="320" fill="url(#treasure)" />
    </svg>
  );
}

/* ───────────── حصالة الحمار الزجاجية ───────────── */
type Drop = { key: number; tier: Tier; dir: "in" | "out" } | null;

function CoinDefs() {
  return (
    <>
      {(Object.keys(TIERS) as Tier[]).map((t) => (
        <radialGradient key={t} id={`cg-${t}`} cx="35%" cy="30%" r="90%">
          <stop offset="0%" stopColor={TIERS[t].light} />
          <stop offset="55%" stopColor={TIERS[t].main} />
          <stop offset="100%" stopColor={TIERS[t].dark} />
        </radialGradient>
      ))}
    </>
  );
}

function DonkeyBank({ coins, drop, shakeKey }: { coins: Tier[]; drop: Drop; shakeKey: number }) {
  const controls = useAnimation();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (shakeKey === 0 || reduce) return;
    controls.start({
      rotate: [0, -1.4, 1.1, -0.5, 0],
      scaleY: [1, 0.98, 1.012, 1],
      transition: { duration: 0.5, delay: 0.3 },
    });
  }, [shakeKey, controls, reduce]);

  const visible = coins.slice(-MAX_VISIBLE_COINS);
  const offset = coins.length - visible.length;

  return (
    <svg viewBox="0 -30 480 410" className="relative mx-auto h-auto w-full max-w-[520px]" role="img" aria-label={`الحمار يحمل ${coins.length} كوين`}>
      <defs>
        <CoinDefs />
        <clipPath id="bodyClip">
          <ellipse cx="240" cy="185" rx="150" ry="84" />
        </clipPath>
        <linearGradient id="glass" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#e6e2f5" stopOpacity=".5" />
          <stop offset="55%" stopColor="#a9a3c9" stopOpacity=".26" />
          <stop offset="100%" stopColor="#6e6a99" stopOpacity=".5" />
        </linearGradient>
        <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity=".9" />
          <stop offset="50%" stopColor="#b7b1d6" stopOpacity=".6" />
          <stop offset="100%" stopColor="#5a5684" stopOpacity=".95" />
        </linearGradient>
        <linearGradient id="donkey" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bdb2a9" />
          <stop offset="100%" stopColor="#7b716b" />
        </linearGradient>
        <linearGradient id="muzzle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6ecde" />
          <stop offset="100%" stopColor="#d9cbb7" />
        </linearGradient>
        <linearGradient id="blanket" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b3202f" />
          <stop offset="100%" stopColor="#7a1220" />
        </linearGradient>
        <linearGradient id="brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f3d98a" />
          <stop offset="100%" stopColor="#8f6a1c" />
        </linearGradient>
        <radialGradient id="floorGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity=".6" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="245" cy="342" rx="200" ry="15" fill="url(#floorGlow)" />

      <motion.g animate={controls} style={{ transformOrigin: "240px 338px" }}>
        {/* الأرجل البعيدة والذيل */}
        <rect x="146" y="236" width="26" height="100" rx="12" fill="#6a615c" />
        <rect x="346" y="236" width="26" height="100" rx="12" fill="#6a615c" />
        <rect x="146" y="322" width="26" height="14" rx="5" fill="#2c2623" />
        <rect x="346" y="322" width="26" height="14" rx="5" fill="#2c2623" />
        <path d="M94 140 C56 150 50 200 64 240" fill="none" stroke="#5b524d" strokeWidth="9" strokeLinecap="round" />
        <ellipse cx="64" cy="248" rx="9" ry="15" fill="#3f3834" />

        {/* الأذنان الطويلتان */}
        <path d="M384 62 Q370 6 388 -18 Q416 0 412 58 Z" fill="#8a807a" />
        <path d="M390 52 Q382 10 391 -6 Q406 8 404 50 Z" fill="#d9a7a0" opacity=".8" />
        <path d="M404 56 Q408 -2 432 -22 Q452 2 434 62 Z" fill="#9a8f88" />
        <path d="M412 50 Q414 6 430 -8 Q440 8 428 52 Z" fill="#d9a7a0" opacity=".85" />

        {/* العنق والرأس */}
        <path d="M330 112 L368 56 L424 84 L396 196 Q360 202 330 190 Z" fill="url(#donkey)" stroke="#6a615c" strokeWidth="2" />
        <ellipse cx="414" cy="92" rx="46" ry="32" transform="rotate(32 414 92)" fill="url(#donkey)" stroke="#6a615c" strokeWidth="2" />
        <ellipse cx="446" cy="128" rx="26" ry="21" fill="url(#muzzle)" stroke="#b9a98f" strokeWidth="2" />
        <ellipse cx="457" cy="124" rx="4" ry="6.5" fill="#4a3f3a" />
        <path d="M436 142 Q448 148 460 140" fill="none" stroke="#4a3f3a" strokeWidth="2.2" strokeLinecap="round" />
        <ellipse cx="410" cy="84" rx="10" ry="8" fill="#f6ecde" />
        <circle cx="410" cy="84" r="6.5" fill="#1c1512" />
        <circle cx="407.5" cy="81.5" r="2.3" fill="#fff" />
        {/* العُرف واللجام */}
        <path d="M396 60 Q404 40 414 58" fill="none" stroke="#4b4540" strokeWidth="6" strokeLinecap="round" />
        <path d="M372 58 Q356 72 366 90 Q348 102 362 120 Q346 134 360 152" fill="none" stroke="#4b4540" strokeWidth="9" strokeLinecap="round" />
        <path d="M430 112 Q450 114 466 126" fill="none" stroke="#e3b94d" strokeWidth="4" strokeLinecap="round" />
        <path d="M404 96 L426 124" fill="none" stroke="#e3b94d" strokeWidth="3" strokeLinecap="round" />
        <circle cx="426" cy="124" r="3.6" fill="#f3d98a" stroke="#8f6a1c" />

        {/* داخل الجسم الزجاجي والكوينز */}
        <ellipse cx="240" cy="185" rx="150" ry="84" fill="#16183a" opacity=".62" />
        <g clipPath="url(#bodyClip)">
          {visible.map((tier, i) => {
            const row = Math.floor(i / 10);
            const col = i % 10;
            const x = 112 + col * 28 + (row % 2) * 14 + (((i * 37) % 7) - 3);
            const y = 262 - row * 12 + (((i * 13) % 5) - 2);
            return (
              <g key={offset + i}>
                <ellipse cx={x} cy={y + 3} rx="14" ry="8.5" fill={TIERS[tier].dark} />
                <ellipse cx={x} cy={y} rx="14" ry="8.5" fill={`url(#cg-${tier})`} stroke={TIERS[tier].dark} strokeWidth="1" />
                <ellipse cx={x} cy={y} rx="8.5" ry="4.8" fill="none" stroke={TIERS[tier].dark} strokeOpacity=".45" />
              </g>
            );
          })}
        </g>

        {/* طبقة الزجاج */}
        <ellipse cx="240" cy="185" rx="152" ry="86" fill="url(#glass)" stroke="url(#rim)" strokeWidth="4" />
        <path d="M110 150 Q128 112 190 100" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="8" strokeLinecap="round" />
        <circle cx="102" cy="172" r="3.6" fill="#fff" opacity=".8" />
        <path d="M368 150 Q378 184 362 216" fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="6" strokeLinecap="round" />
        <path d="M132 240 Q240 274 350 236" fill="none" stroke="#fff" strokeOpacity=".15" strokeWidth="5" strokeLinecap="round" />

        {/* الأرجل القريبة */}
        <rect x="104" y="236" width="28" height="100" rx="13" fill="url(#donkey)" stroke="#6a615c" strokeWidth="2" />
        <rect x="306" y="236" width="28" height="100" rx="13" fill="url(#donkey)" stroke="#6a615c" strokeWidth="2" />
        <rect x="104" y="322" width="28" height="14" rx="5" fill="#2c2623" />
        <rect x="306" y="322" width="28" height="14" rx="5" fill="#2c2623" />

        {/* سرج الحمار وفتحة العملات */}
        <path d="M168 98 Q240 84 312 98 L304 156 Q240 168 176 156 Z" fill="url(#blanket)" stroke="#e3b94d" strokeWidth="3" />
        <path d="M190 128 l14 -12 l14 12 l-14 12 Z M233 128 l14 -12 l14 12 l-14 12 Z M276 128 l14 -12 l14 12 l-14 12 Z" fill="none" stroke="#f3d98a" strokeWidth="2" />
        {[186, 208, 232, 256, 280, 302].map((x) => (
          <circle key={x} cx={x} cy="162" r="3" fill="#e3b94d" />
        ))}
        <rect x="205" y="84" width="70" height="14" rx="7" fill="url(#brass)" />
        <rect x="213" y="88" width="54" height="6" rx="3" fill="#1b0f18" />
      </motion.g>

      {/* الكوين الساقط / الصاعد */}
      <AnimatePresence>
        {drop && (
          <motion.g key={drop.key} exit={{ opacity: 0 }}>
            <motion.ellipse
              cx="240"
              fill={`url(#cg-${drop.tier})`}
              stroke={TIERS[drop.tier].dark}
              strokeWidth="2.5"
              initial={{ cy: drop.dir === "in" ? -20 : 90, opacity: 1, rx: 17, ry: 17 }}
              animate={
                reduce
                  ? { cy: 90, opacity: 0 }
                  : {
                      cy: drop.dir === "in" ? 90 : -20,
                      rx: [17, 4, 17, 4, 12],
                      ry: [17, 17, 17, 17, 12],
                      opacity: drop.dir === "in" ? [1, 1, 1, 0] : [1, 1, 0],
                    }
              }
              transition={{ duration: 0.55, ease: "easeIn" }}
            />
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}

/* ───────────── شارة الفئة ───────────── */
function TierBadge({ tier }: { tier: Tier }) {
  const t = TIERS[tier];
  return (
    <motion.span
      key={tier}
      initial={{ scale: 0.7 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 15 }}
      className="inline-flex w-[84px] items-center justify-center gap-2 rounded-full py-1 text-sm font-semibold"
      style={{ background: `${t.main}26`, color: t.dark, boxShadow: `inset 0 0 0 1.5px ${t.main}` }}
    >
      <span className="h-3 w-3 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${t.light}, ${t.main} 60%, ${t.dark})` }} />
      {t.label}
    </motion.span>
  );
}

/* ───────────── صف العضو ───────────── */
function MemberRow({ member, role, money, onRename, onAdd }: { member: Member; role: number; money: number; onRename: (id: number, n: string) => void; onAdd: (id: number) => void }) {
  const tier = getTier(member.points);
  const t = TIERS[tier];
  const next = t.next;
  const pct = next ? Math.min(100, ((member.points - t.from) / (next.at - t.from)) * 100) : 100;

  return (
    <motion.li
      layout="position"
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-3 py-4 sm:grid-cols-[auto_minmax(0,1.1fr)_auto_minmax(0,1fr)_auto_auto]"
    >
      <motion.div
        key={role}
        initial={{ scale: 0.8, rotate: -6 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 16 }}
        className="rounded-full"
        style={role === 0 ? { boxShadow: "0 0 0 3px #f3e4c0, 0 0 22px 4px rgba(227,185,77,.75)" } : undefined}
      >
        <Avatar role={role} size={64} />
      </motion.div>

      <div className="min-w-0">
        <input
          value={member.name}
          onChange={(e) => onRename(member.id, e.target.value)}
          maxLength={20}
          aria-label={`اسم العضو ${member.name}`}
          className="w-full min-w-0 rounded-md bg-transparent px-1 text-lg font-bold hover:bg-black/[.05] focus:bg-black/[.05]"
        />
        <div className="font-title px-1 text-lg leading-tight" style={{ color: role === 0 ? "#9a6f12" : "#6b4a2b" }}>
          {ROLES[role].title}
        </div>
      </div>

      <div className="justify-self-end sm:justify-self-auto">
        <TierBadge tier={tier} />
      </div>

      <div className="col-span-3 sm:col-span-1">
        <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${t.main}, ${t.light})` }} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 160, damping: 22 }} />
        </div>
        <div className="mt-1 text-xs text-[var(--slate)]">{next ? `باقي ${next.at - member.points} للوصول إلى ${next.label}` : "أعلى فئة"}</div>
      </div>

      <div className="col-span-3 flex items-center justify-between gap-4 sm:contents">
        <div className="min-w-[5.5rem] text-end">
          <div className="num text-4xl font-bold leading-none" style={{ color: t.dark }}>
            <AnimatedNumber value={member.points} />
          </div>
          <div className="num mt-1 text-xs text-[var(--slate)]">{money} قرش</div>
        </div>
        <button
          onClick={() => onAdd(member.id)}
          aria-label={`أضف نقطة لـ ${member.name}`}
          className="h-12 w-16 rounded-xl border border-[#e3b94d] bg-[linear-gradient(#3b2f86,#231a52)] text-lg font-bold text-[#f3d98a] shadow-[0_2px_0_#0b0830] transition hover:brightness-125 active:translate-y-px"
        >
          +1
        </button>
      </div>
    </motion.li>
  );
}

/* ───────────── الصفحة ───────────── */
export default function Page() {
  const [members, setMembers] = useState<Member[]>(DEFAULT_MEMBERS);
  const [history, setHistory] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [confirmReset, setConfirmReset] = useState(false);
  const [drop, setDrop] = useState<Drop>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);
  const dropCounter = useRef(0);
  const dropTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sound = useSound();

  // تحميل الحالة من قاعدة البيانات
  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const r = await fetch("/api/state", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const s = await r.json();
      if (s && Array.isArray(s.members) && s.members.length === 6 && Array.isArray(s.history)) {
        setMembers(s.members);
        setHistory(s.history);
      }
      setReady(true);
      setStatus("saved");
    } catch {
      setStatus("offline"); // لا نكتب شيئاً فوق البيانات إذا فشل التحميل
    }
  }, []);

  useEffect(() => {
    load();
    try {
      if (localStorage.getItem(MUTE_KEY) === "1") sound.setMuted(true);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(MUTE_KEY, sound.muted ? "1" : "0");
    } catch {}
  }, [sound.muted]);

  // حفظ تلقائي في قاعدة البيانات
  useEffect(() => {
    if (!ready) return;
    setStatus("saving");
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ members, history }),
        });
        setStatus(r.ok ? "saved" : "error");
      } catch {
        setStatus("error");
      }
    }, 200);
    return () => clearTimeout(t);
  }, [members, history, ready]);

  const showDrop = (tier: Tier, dir: "in" | "out") => {
    dropCounter.current += 1;
    setDrop({ key: dropCounter.current, tier, dir });
    if (dropTimer.current) clearTimeout(dropTimer.current);
    dropTimer.current = setTimeout(() => setDrop(null), 700);
  };

  const showToast = (text: string) => {
    setToast({ key: Date.now(), text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const addPoint = (id: number) => {
    if (!ready) return;
    const m = members.find((x) => x.id === id);
    if (!m) return;
    const newPoints = m.points + 1;
    const tier = getTier(newPoints);
    const newMembers = members.map((x) => (x.id === id ? { ...x, points: newPoints } : x));
    const newHistory = [...history, { memberId: id, tier }];

    // هل تغيّر لقب العضو (ترقّى في الترتيب)؟
    const before = rankMembers(members, history).findIndex((x) => x.id === id);
    const after = rankMembers(newMembers, newHistory).findIndex((x) => x.id === id);
    const n = members.length;
    if (after < before) showToast(`${m.name} ترقّى إلى ${ROLES[roleIndex(after, n)].title}`);

    setMembers(newMembers);
    setHistory(newHistory);
    showDrop(tier, "in");
    setShakeKey((k) => k + 1);
    sound.coin();
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last || !ready) return;
    setMembers((prev) => prev.map((x) => (x.id === last.memberId ? { ...x, points: Math.max(0, x.points - 1) } : x)));
    setHistory((h) => h.slice(0, -1));
    showDrop(last.tier, "out");
    sound.undo();
  };

  const rename = (id: number, name: string) => setMembers((prev) => prev.map((x) => (x.id === id ? { ...x, name } : x)));

  const resetAll = () => {
    setMembers(DEFAULT_MEMBERS);
    setHistory([]);
    setConfirmReset(false);
  };

  const ranked = rankMembers(members, history);
  const total = history.length;
  const totalMoney = history.reduce((sum, h) => sum + TIERS[h.tier].value, 0);
  const moneyByMember: Record<number, number> = {};
  history.forEach((h) => {
    moneyByMember[h.memberId] = (moneyByMember[h.memberId] ?? 0) + TIERS[h.tier].value;
  });
  const lastEntry = history[history.length - 1];
  const lastName = lastEntry ? members.find((m) => m.id === lastEntry.memberId)?.name : null;

  const statusText: Record<Status, string> = {
    loading: "جارٍ التحميل…",
    saved: "تم الحفظ في قاعدة البيانات",
    saving: "جارٍ الحفظ…",
    error: "تعذّر الحفظ — تحقق من الخادم",
    offline: "تعذّر الاتصال بالخادم",
  };
  const statusColor = status === "error" || status === "offline" ? "#ff9d92" : "#c9bfa0";
  const ghost = "rounded-lg border border-[#e3b94d]/40 bg-white/5 px-4 py-2 text-sm font-semibold text-[#f3e6c4] transition hover:bg-white/10";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-title text-4xl font-bold leading-tight text-[#f3d98a] sm:text-5xl">حصالة علي بابا</h1>
          <div className="font-title text-xl text-[#e3b94d]/90">والأربعين حرامي</div>
          <p className="mt-1 text-sm" style={{ color: statusColor }} aria-live="polite">
            {statusText[status]}
            {status === "offline" && (
              <button onClick={load} className="ms-2 underline">
                إعادة المحاولة
              </button>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={undo} disabled={history.length === 0} className={`${ghost} disabled:cursor-not-allowed disabled:opacity-40`}>
            تراجع
          </button>
          <button onClick={() => sound.setMuted(!sound.muted)} aria-pressed={sound.muted} className={ghost}>
            {sound.muted ? "تشغيل الصوت" : "كتم الصوت"}
          </button>
          <button onClick={() => setConfirmReset(true)} className="rounded-lg border border-[#ff9d92]/50 bg-white/5 px-4 py-2 text-sm font-semibold text-[#ffb4a8] transition hover:bg-[#ff9d92]/10">
            تصفير
          </button>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* كهف الكنز */}
        <section className="relative self-start overflow-hidden rounded-[28px] border border-[#e3b94d]/30 px-6 pb-8 pt-12 text-white lg:sticky lg:top-8" style={{ boxShadow: "0 30px 60px -30px #000" }}>
          <CaveBackdrop />
          <div className="relative">
            <DonkeyBank coins={history.map((h) => h.tier)} drop={drop} shakeKey={shakeKey} />
            <div className="mt-4 text-center">
              <div className="flex items-baseline justify-center gap-3" style={{ color: "#f3d98a" }} aria-live="polite">
                <span className="num text-7xl font-bold leading-none">
                  <AnimatedNumber value={totalMoney} />
                </span>
                <span className="font-title text-3xl">قرش</span>
              </div>
              <div className="mt-2 text-base text-white/75">
                {total} نقطة{totalMoney >= 100 ? ` · ${dinar(totalMoney)} دينار` : ""}
              </div>
              {total > 0 && (
                <div className="font-title mt-3 text-xl text-[#f3d98a]">
                  {ranked[ranked.length - 1].name} هو علي بابا الآن
                </div>
              )}
              <div className="mt-1 min-h-5 text-sm text-white/55">{lastName && lastEntry ? `آخر تسجيل: ${lastName} (+${TIERS[lastEntry.tier].value} قروش)` : "اضغط +1 بجانب أي عضو لتبدأ"}</div>
              {total > MAX_VISIBLE_COINS && <div className="mt-1 text-xs text-white/40">تُعرض آخر {MAX_VISIBLE_COINS} كوين داخل الحصالة</div>}
            </div>
          </div>
        </section>

        {/* ديوان الترتيب */}
        <section className="parchment px-6 py-3 sm:px-9">
          <ul className="divide-y divide-[var(--line)]">
            {ranked.map((m, i) => (
              <MemberRow key={m.id} member={m} role={roleIndex(i, ranked.length)} money={moneyByMember[m.id] ?? 0} onRename={rename} onAdd={addPoint} />
            ))}
          </ul>
          <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-[var(--line)] py-4 text-sm text-[var(--slate)]">
            <span>فضي: 0–15 · 10 قروش</span>
            <span>برونز: 16–25 · 15 قروش</span>
            <span>ذهبي: 26 فما فوق · 20 قرش</span>
          </div>
        </section>
      </div>

      {/* إشعار الترقية */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            className="font-title fixed left-1/2 top-6 z-40 -translate-x-1/2 rounded-full border-2 border-[#9a6f12] bg-[#f6ebd0] px-6 py-2 text-xl text-[#3a2a17] shadow-xl"
            role="status"
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmReset && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0830]/70 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="تأكيد التصفير">
            <motion.div initial={{ scale: 0.94, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96 }} className="parchment w-full max-w-sm p-7">
              <h2 className="font-title text-2xl font-bold">تصفير الكنز؟</h2>
              <p className="mt-2 text-[var(--slate)]">سيتم حذف كل النقاط والكوينز وإعادة الأسماء الأصلية، وتُحدَّث قاعدة البيانات. لا يمكن التراجع عن ذلك.</p>
              <div className="mt-6 flex gap-3">
                <button onClick={resetAll} className="flex-1 rounded-xl bg-[#9c2019] py-2 font-bold text-white hover:bg-[#b3261e]">
                  نعم، صفّر
                </button>
                <button onClick={() => setConfirmReset(false)} className="flex-1 rounded-xl border border-[var(--line)] py-2 font-bold hover:bg-black/5">
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
