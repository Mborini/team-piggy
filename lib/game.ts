export const POINT_QIRSH = 5;
export const MAX_POINTS = 100000;
export type Member = { id: number; name: string; points: number };
export type Entry = { memberId: number; tier: "silver" | "bronze" | "gold" };
export type Draw = { id: string; dessertId: string; at: string };
export type GameState = { members: Member[]; history: Entry[]; draws: Draw[] };
export function removePoint(state: GameState, memberId: number): GameState {
  if (!state.members.some((m) => m.id === memberId && m.points > 0))
    return state;
  let index = state.history.length - 1;
  while (index >= 0 && state.history[index].memberId !== memberId) index--;
  if (index < 0) return state;
  return {
    ...state,
    members: state.members.map((m) =>
      m.id === memberId ? { ...m, points: m.points - 1 } : m,
    ),
    history: state.history.filter((_, i) => i !== index),
  };
}
export const DEFAULT_MEMBERS: Member[] = [
  "نائل",
  "Borini",
  "نايف",
  "خلايلة",
  "زياد",
  "مجدي",
].map((name, i) => ({ id: i + 1, name, points: 0 }));
export const DESSERTS = [
  {
    id: "chocolate",
    name: "كيك شوكولاته",
    short: "شوكولاته",
    note: "لأصحاب المزاج الشوكولاتي",
    color: "#765145",
  },
  {
    id: "kunafa",
    name: "كنافة",
    short: "كنافة",
    note: "الذهبية اللي الكل بحبّها",
    color: "#d99539",
  },
  {
    id: "harissa",
    name: "هريسة",
    short: "هريسة",
    note: "حلاوة اللمّة وبساطة الطعم",
    color: "#c67a51",
  },
  {
    id: "turkish",
    name: "كيكة تركية",
    short: "كيكة تركية",
    note: "طرية، خفيفة، ومليانة حلا",
    color: "#9a755e",
  },
  {
    id: "baklava",
    name: "بقلاوة",
    short: "بقلاوة",
    note: "طبقات من القرمشة والفستق",
    color: "#849467",
  },
  {
    id: "beyn",
    name: "بين نارين",
    short: "بين نارين",
    note: "قشطة بين طبقتين من الحلا",
    color: "#ba704d",
  },
  {
    id: "awama",
    name: "عوامة",
    short: "عوامة",
    note: "لقمة ذهبية، وفرحة كبيرة",
    color: "#bc913f",
  },
  {
    id: "om-ali",
    name: "أم علي",
    short: "أم علي",
    note: "حلا دافي على أصوله",
    color: "#b48d78",
  },
  {
    id: "cheese",
    name: "حلاوة الجبن",
    short: "حلاوة الجبن",
    note: "قشطة وفستق وطعم شامي",
    color: "#788769",
  },
  {
    id: "delight",
    name: "راحة حلقوم وبسكوت",
    short: "راحة وبسكوت",
    note: "الثنائي الحلو مع فنجان قهوة",
    color: "#b77986",
  },
] as const;

export function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const s = value as GameState;
  if (
    !Array.isArray(s.members) ||
    s.members.length !== 6 ||
    !Array.isArray(s.history) ||
    s.history.length >= 600000
  )
    return false;
  const seen = new Set<number>();
  for (const m of s.members) {
    if (
      !m ||
      !Number.isInteger(m.id) ||
      m.id < 1 ||
      m.id > 6 ||
      seen.has(m.id) ||
      typeof m.name !== "string" ||
      !m.name.trim() ||
      m.name.length > 20 ||
      !Number.isInteger(m.points) ||
      m.points < 0 ||
      m.points > MAX_POINTS
    )
      return false;
    seen.add(m.id);
  }
  const counts = new Map<number, number>();
  for (const h of s.history) {
    if (
      !h ||
      !seen.has(h.memberId) ||
      !["silver", "bronze", "gold"].includes(h.tier)
    )
      return false;
    counts.set(h.memberId, (counts.get(h.memberId) || 0) + 1);
  }
  if (s.members.some((m) => (counts.get(m.id) || 0) !== m.points)) return false;
  return (
    Array.isArray(s.draws) &&
    s.draws.length <= 100 &&
    s.draws.every(
      (d) =>
        d &&
        typeof d.id === "string" &&
        d.id.length <= 64 &&
        DESSERTS.some((x) => x.id === d.dessertId) &&
        typeof d.at === "string" &&
        Number.isFinite(Date.parse(d.at)),
    )
  );
}

export function pickDessert(): number {
  const range = 2 ** 32;
  const limit = range - (range % DESSERTS.length);
  const random = new Uint32Array(1);
  do {
    crypto.getRandomValues(random);
  } while (random[0] >= limit);
  return random[0] % DESSERTS.length;
}

export function rotationFor(index: number, current: number): number {
  const slice = 360 / DESSERTS.length;
  const target = (360 - (index + 0.5) * slice) % 360;
  return current + 360 * 6 + ((target - (current % 360) + 360) % 360);
}
