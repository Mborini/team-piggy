let ctx: AudioContext | null = null;
function ac() {
  if (typeof window === "undefined") return null;
  const C = window.AudioContext || (window as any).webkitAudioContext;
  if (!ctx && C) ctx = new C();
  if (ctx?.state === "suspended") ctx.resume();
  return ctx;
}
function tone(freq: number, at: number, dur: number, type: OscillatorType = "sine", vol = 0.22) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at;
  o.type = type; o.frequency.value = freq;
  o.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t); o.stop(t + dur);
}
export const unlockAudio = () => void ac();
export const playCorrect = () => { tone(523, 0, 0.18); tone(659, 0.14, 0.18); tone(784, 0.28, 0.45); };
export const playWrong = () => { tone(196, 0, 0.35, "sawtooth", 0.15); tone(147, 0.2, 0.5, "sawtooth", 0.15); };
export const playTick = () => tone(880, 0, 0.07, "square", 0.08);
export const playFinish = () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.16, 0.4)); };