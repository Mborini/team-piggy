"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Game from "./Game";

const MUSIC_SRC = "/conan/music.mp3";
const IMAGE_SRC = "/conan/cover.png"; // صورة صفحة الافتتاح
const VOLUME = 0.35; // من 0 إلى 1، منخفض حتى تبقى أصوات اللعبة واضحة
const SCHOOL = "أكاديمية ومدارس المجددون الدولية";
const TEACHER = "الأستاذ حسن الساكت";
const TITLE = "المحقق الذكي";

function Crest() {
  return (
    <svg viewBox="0 0 80 92" width="96" height="110" aria-hidden="true">
      <defs>
        <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3d58a" />
          <stop offset="1" stopColor="#b98a2e" />
        </linearGradient>
      </defs>
      <path d="M40 3 74 15v31c0 22-14 36-34 43C20 82 6 68 6 46V15Z" fill="#0c1b4d" stroke="url(#cg2)" strokeWidth="3.5" />
      <path d="M40 11 67 20v26c0 17-11 29-27 35-16-6-27-18-27-35V20Z" fill="none" stroke="url(#cg2)" strokeWidth="1.2" opacity=".6" />
      <circle cx="37" cy="40" r="14" fill="rgba(191,227,255,.1)" stroke="#bfe3ff" strokeWidth="3.5" />
      <path d="M30 36a8 8 0 0 1 6-5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".8" />
      <path d="m47 50 12 12" stroke="#e23a48" strokeWidth="6" strokeLinecap="round" />
      <path d="m40 12 1.8 3.8 4.2.6-3 3 .7 4.2-3.7-2-3.7 2 .7-4.2-3-3 4.2-.6Z" fill="url(#cg2)" />
    </svg>
  );
}

export default function Experience() {
  const audio = useRef<HTMLAudioElement>(null);
  const [entered, setEntered] = useState(false);
  const [muted, setMuted] = useState(false);
  const [imgOk, setImgOk] = useState(true);

  const play = useCallback(() => {
    audio.current?.play().catch(() => {});
  }, []);

  // تشغيل الموسيقى وإعادة تشغيلها إذا توقفت
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    a.volume = VOLUME;
    play();
    const unlock = () => play();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    const id = setInterval(() => { if (a.paused) play(); }, 3000);
    return () => {
      clearInterval(id);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [play]);

  useEffect(() => {
    if (audio.current) audio.current.muted = muted;
  }, [muted]);

  const enter = () => { play(); setEntered(true); };

  return (
    <>
      <audio ref={audio} src={MUSIC_SRC} loop preload="auto" />

      {entered ? (
        <Game />
      ) : (
        <main className="cover">
          <div className="cover-card">
            {imgOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="cover-img"
                src={IMAGE_SRC}
                alt={SCHOOL}
                onError={() => setImgOk(false)}
              />
            ) : (
              <Crest />
            )}
            <h1>{SCHOOL}</h1>
            <div className="cover-rule"><i /><span>تقدّم</span><i /></div>
            <h2>مسابقة {TITLE}</h2>
            <p className="by">إعداد <b>{TEACHER}</b></p>
            <button className="cta" onClick={enter}>ادخل المسابقة</button>
          </div>
        </main>
      )}

      <button
        className="music"
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
        title={muted ? "تشغيل الصوت" : "كتم الصوت"}
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </>
  );
}