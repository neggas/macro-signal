import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const pair = searchParams.get("pair");

    let query = `SELECT id, snapshot_date as snapshotDate, pair, signal, strength, macro_diff as macroDiff, entry_price as entryPrice, exit_price as exitPrice, return_pct as returnPct, result FROM signal_snapshots WHERE 1=1`;
    const params: (string | number)[] = [];

    if (status) {
      query += " AND result = ?";
      params.push(status);
    }
    if (pair) {
      query += " AND pair = ?";
      params.push(pair);
    }

    query += " ORDER BY snapshot_date DESC";
    const rows = db.prepare(query).all(...params);
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { snapshotDate, pair, signal, strength, macroDiff, entryPrice } = body;
    if (!snapshotDate || !pair || !signal || strength === undefined) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }
    const stmt = db.prepare(
      `INSERT INTO signal_snapshots (snapshot_date, pair, signal, strength, macro_diff, entry_price)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(snapshot_date, pair) DO UPDATE SET
         signal=excluded.signal, strength=excluded.strength, macro_diff=excluded.macro_diff, entry_price=excluded.entry_price`
    );
    const result = stmt.run(
      snapshotDate,
      pair,
      signal,
      strength,
      macroDiff ?? 0,
      entryPrice ?? 0
    );
    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
