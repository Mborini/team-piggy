
import { NextResponse } from "next/server";
import { readState, writeState } from "@/lib/db";

const TIERS = ["silver", "bronze", "gold"];
const VALID_IDS = new Set([1, 2, 3, 4, 5, 6]);

function isValid(s: any): boolean {
  if (!s || !Array.isArray(s.members) || s.members.length !== 6) return false;
  const seen = new Set<number>();
  const membersOk = s.members.every((m: any) => {
    if (!VALID_IDS.has(m?.id) || seen.has(m.id)) return false;
    seen.add(m.id);
    return (
      typeof m.name === "string" &&
      m.name.length <= 20 &&
      Number.isInteger(m.points) &&
      m.points >= 0
    );
  });
  return (
    membersOk &&
    Array.isArray(s.history) &&
    s.history.length < 100000 &&
    s.history.every((h: any) => VALID_IDS.has(h?.memberId) && TIERS.includes(h?.tier))
  );
}

// تفاصيل الخطأ تظهر فقط أثناء التطوير لتسهيل التشخيص
const detail = (e: unknown) => (process.env.NODE_ENV !== "production" ? String((e as Error)?.message ?? e) : undefined);

export async function GET() {
  try {
    return NextResponse.json(await readState());
  } catch (e) {
    console.error("read_failed", e);
    return NextResponse.json({ error: "read_failed", detail: detail(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (!isValid(body)) return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  try {
    await writeState(body.members, body.history);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("write_failed", e);
    return NextResponse.json({ error: "write_failed", detail: detail(e) }, { status: 500 });
  }
}