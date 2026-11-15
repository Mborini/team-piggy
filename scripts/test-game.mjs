import assert from "node:assert/strict";
import {
  DEFAULT_MEMBERS,
  DESSERTS,
  POINT_QIRSH,
  isGameState,
  pickDessert,
  rotationFor,
} from "../lib/game.ts";

const initial = {
  members: DEFAULT_MEMBERS.map((m) => ({ ...m })),
  history: [],
  draws: [],
};
assert.ok(isGameState(initial));
assert.equal((20 * POINT_QIRSH) / 100, 1);
const legacy = structuredClone(initial);
legacy.members[0].points = 3;
legacy.history = ["silver", "bronze", "gold"].map((tier) => ({
  memberId: 1,
  tier,
}));
assert.ok(isGameState(legacy), "Old events and scores survive the change");
assert.equal(
  legacy.members[0].points * POINT_QIRSH,
  15,
  "Every historical point now costs five qirsh",
);
assert.equal(
  isGameState({
    ...initial,
    members: [...initial.members.slice(1), initial.members[1]],
  }),
  false,
);
assert.equal(
  isGameState({
    ...initial,
    members: initial.members.map((m, i) => (i ? m : { ...m, points: -1 })),
  }),
  false,
);
assert.equal(
  isGameState({
    ...initial,
    members: initial.members.map((m, i) => (i ? m : { ...m, points: 1 })),
  }),
  false,
  "Totals must agree with events",
);
assert.equal(
  isGameState({
    ...initial,
    draws: [{ id: "x", dessertId: "unknown", at: new Date().toISOString() }],
  }),
  false,
);
assert.equal(
  isGameState({
    ...initial,
    draws: [{ id: "x", dessertId: "kunafa", at: "invalid" }],
  }),
  false,
);
assert.ok(
  isGameState({
    ...initial,
    draws: [{ id: "x", dessertId: "kunafa", at: new Date().toISOString() }],
  }),
);
for (let current = 0; current < 20000; current += 173) {
  for (let index = 0; index < DESSERTS.length; index++) {
    const rotation = rotationFor(index, current);
    assert.ok(rotation >= current + 6 * 360);
    const sliceAtPointer = Math.floor(
      ((360 - (rotation % 360)) % 360) / (360 / DESSERTS.length),
    );
    assert.equal(sliceAtPointer, index, "Pointer must match the saved result");
  }
}
const seen = new Set(Array.from({ length: 1000 }, pickDessert));
assert.equal(seen.size, DESSERTS.length);
assert.ok([...seen].every((index) => index >= 0 && index < DESSERTS.length));
console.log(
  "Passed: fixed pricing, legacy scores, validation, all wheel landing positions and random bounds.",
);

const { removePoint } = await import("../lib/game.ts");
const { monthEnd, timeRemaining } = await import("../lib/month-end.ts");
const mixed = structuredClone(initial);
mixed.members[0].points = 2;
mixed.members[1].points = 1;
mixed.history = [
  { memberId: 1, tier: "gold" },
  { memberId: 2, tier: "silver" },
  { memberId: 1, tier: "bronze" },
];
const reduced = removePoint(mixed, 1);
assert.equal(reduced.members[0].points, 1);
assert.equal(reduced.members[1].points, 1);
assert.deepEqual(reduced.history, mixed.history.slice(0, 2));
assert.ok(isGameState(reduced));
assert.equal(
  removePoint(initial, 1),
  initial,
  "Zero points cannot become negative",
);
assert.equal(
  mixed.members[0].points,
  2,
  "Subtraction does not mutate the previous state",
);
assert.equal(
  new Date(monthEnd(new Date("2026-11-15T12:00:00Z")).deadline).toISOString(),
  "2026-11-30T21:00:00.000Z",
);
assert.equal(
  new Date(monthEnd(new Date("2026-12-31T20:59:59Z")).deadline).toISOString(),
  "2026-12-31T21:00:00.000Z",
);
assert.equal(
  new Date(monthEnd(new Date("2028-02-15T12:00:00Z")).deadline).toISOString(),
  "2028-02-29T21:00:00.000Z",
);
assert.equal(
  new Date(monthEnd(new Date("2026-11-30T21:00:00Z")).deadline).toISOString(),
  "2026-12-31T21:00:00.000Z",
  "Use the month in Amman rather than UTC",
);
assert.deepEqual(timeRemaining(90061000, 0), {
  days: 1,
  hours: 1,
  minutes: 1,
  seconds: 1,
  finished: false,
});
assert.ok(timeRemaining(1000, 2000).finished);
console.log(
  "Passed: per-player subtraction, zero floor, Amman month end, leap year, year rollover and countdown.",
);
