import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const currencyId = searchParams.get("currencyId");
    const date = searchParams.get("date");
    if (!currencyId) {
      return NextResponse.json({ error: "currencyId required" }, { status: 400 });
    }

    if (date) {
      // specific date snapshot
      const rows = db
        .prepare(
          `SELECT id, currency_id as currencyId, indicator_name as name, category, previous, forecast, actual, sigma, sign, weight, release_date as releaseDate
           FROM indicator_data WHERE currency_id = ? AND release_date = ? ORDER BY category, name`
        )
        .all(Number(currencyId), date);
      return NextResponse.json(rows);
    }

    // latest per indicator
    const rows = db
      .prepare(
        `SELECT id, currency_id as currencyId, indicator_name as name, category, previous, forecast, actual, sigma, sign, weight, release_date as releaseDate
         FROM indicator_data WHERE currency_id = ?
         AND (indicator_name, release_date) IN (
           SELECT indicator_name, MAX(release_date) FROM indicator_data WHERE currency_id = ? GROUP BY indicator_name
         )
         ORDER BY category, name`
      )
      .all(Number(currencyId), Number(currencyId));
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { currencyId, name, category, previous, forecast, actual, sigma, sign, weight, releaseDate } = body;
    if (!currencyId || !name || !category || sign === undefined || weight === undefined || !releaseDate) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }
    const stmt = db.prepare(
      `INSERT INTO indicator_data (currency_id, indicator_name, category, previous, forecast, actual, sigma, sign, weight, release_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(currency_id, indicator_name, release_date) DO UPDATE SET
         previous=excluded.previous, forecast=excluded.forecast, actual=excluded.actual, sigma=excluded.sigma, updated_at=unixepoch()`
    );
    const result = stmt.run(
      currencyId,
      name,
      category,
      previous ?? 0,
      forecast ?? 0,
      actual ?? 0,
      sigma ?? 0,
      sign,
      weight,
      releaseDate
    );
    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, previous, forecast, actual, sigma, releaseDate } = body;
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const fields: string[] = [];
    const values: unknown[] = [];
    if (previous !== undefined) { fields.push("previous = ?"); values.push(previous); }
    if (forecast !== undefined) { fields.push("forecast = ?"); values.push(forecast); }
    if (actual !== undefined) { fields.push("actual = ?"); values.push(actual); }
    if (sigma !== undefined) { fields.push("sigma = ?"); values.push(sigma); }
    if (releaseDate !== undefined) { fields.push("release_date = ?"); values.push(releaseDate); }
    if (fields.length === 0) {
      return NextResponse.json({ error: "no fields to update" }, { status: 400 });
    }
    values.push(id);
    db.prepare(`UPDATE indicator_data SET ${fields.join(", ")}, updated_at = unixepoch() WHERE id = ?`).run(...values);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
