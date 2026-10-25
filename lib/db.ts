import { neon } from "@neondatabase/serverless";

const DEFAULT_NAMES = ["نائل", "Borini", "نايف", "خلايلة", "زياد", "مجدي"];

export type Tier = "silver" | "bronze" | "gold";
export type Member = { id: number; name: string; points: number };
export type Entry = { memberId: number; tier: Tier };

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL غير موجود. أضفه في .env.local (رابط الاتصال من لوحة Neon).");
}
const sql = neon(process.env.DATABASE_URL);

// إنشاء الجداول وتعبئة الأعضاء مرة واحدة فقط لكل عملية تشغيل
const g = globalThis as unknown as { __piggyReady?: Promise<void> };

async function setup() {
  await sql`
    CREATE TABLE IF NOT EXISTS members (
      id     INTEGER PRIMARY KEY,
      name   TEXT    NOT NULL CHECK (char_length(name) <= 20),
      points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS score_events (
      id         BIGSERIAL PRIMARY KEY,
      member_id  INTEGER     NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      tier       TEXT        NOT NULL CHECK (tier IN ('silver','bronze','gold')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_events_member ON score_events(member_id)`;

  const ids = DEFAULT_NAMES.map((_, i) => i + 1);
  await sql`
    INSERT INTO members (id, name, points)
    SELECT u.id, u.name, 0
    FROM unnest(${ids}::int[], ${DEFAULT_NAMES}::text[]) AS u(id, name)
    ON CONFLICT (id) DO NOTHING`;
}

function ready() {
  if (!g.__piggyReady) {
    g.__piggyReady = setup().catch((e) => {
      g.__piggyReady = undefined; // اسمح بإعادة المحاولة عند الفشل
      throw e;
    });
  }
  return g.__piggyReady;
}

export async function readState(): Promise<{ members: Member[]; history: Entry[] }> {
  await ready();
  const [members, history] = await Promise.all([
    sql`SELECT id, name, points FROM members ORDER BY id`,
    sql`SELECT member_id AS "memberId", tier FROM score_events ORDER BY id`,
  ]);
  return { members: members as Member[], history: history as Entry[] };
}

// حفظ الحالة كاملة داخل transaction واحدة (إما تنجح كلها أو لا شيء)
export async function writeState(members: Member[], history: Entry[]) {
  await ready();
  const ids = members.map((m) => m.id);
  const names = members.map((m) => m.name);
  const points = members.map((m) => m.points);
  const evMembers = history.map((h) => h.memberId);
  const evTiers = history.map((h) => h.tier);

  await sql.transaction([
    sql`
      UPDATE members SET name = u.name, points = u.points
      FROM unnest(${ids}::int[], ${names}::text[], ${points}::int[]) AS u(id, name, points)
      WHERE members.id = u.id`,
    sql`DELETE FROM score_events`,
    sql`
      INSERT INTO score_events (member_id, tier)
      SELECT u.m, u.t
      FROM unnest(${evMembers}::int[], ${evTiers}::text[]) WITH ORDINALITY AS u(m, t, ord)
      ORDER BY u.ord`,
  ]);
}