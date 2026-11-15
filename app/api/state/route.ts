import { NextResponse } from "next/server";
import { readState, writeState } from "@/lib/db";
import { isGameState } from "@/lib/game";

export async function GET() {
  try {
    return NextResponse.json(await readState(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("read_failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (!isGameState(body))
    return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  try {
    await writeState(body.members, body.history, body.draws);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("write_failed", error);
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
}
