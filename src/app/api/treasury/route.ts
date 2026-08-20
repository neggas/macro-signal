import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const latest = searchParams.get("latest") === "true";

    if (latest) {
      const row = db
        .prepare(
          `SELECT * FROM treasury_rates ORDER BY date DESC LIMIT 1`
        )
        .get();
      return NextResponse.json(row);
    }

    let query = `SELECT * FROM treasury_rates WHERE 1=1`;
    const params: unknown[] = [];

    if (from) {
      query += " AND date >= ?";
      params.push(from);
    }
    if (to) {
      query += " AND date <= ?";
      params.push(to);
    }

    query += " ORDER BY date ASC";
    const rows = db.prepare(query).all(...params);
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
