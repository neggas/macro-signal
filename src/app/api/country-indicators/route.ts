import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const parentCurrencyId = searchParams.get("parentCurrencyId");
    const countryCode = searchParams.get("countryCode");
    const date = searchParams.get("date");

    if (!parentCurrencyId) {
      return NextResponse.json({ error: "parentCurrencyId required" }, { status: 400 });
    }

    const baseQuery = `SELECT id, parent_currency_id as parentCurrencyId, country_code as countryCode, country_name as countryName, indicator_name as name, category, previous, forecast, actual, sigma, sign, weight, release_date as releaseDate FROM country_indicators WHERE parent_currency_id = ?`;
    const params: (string | number)[] = [Number(parentCurrencyId)];

    let query = baseQuery;

    if (countryCode) {
      query += " AND country_code = ?";
      params.push(countryCode);
    }

    if (date) {
      query += " AND release_date = ?";
      params.push(date);
    } else {
      // latest per indicator per country
      query += ` AND (country_code, indicator_name, release_date) IN (
        SELECT country_code, indicator_name, MAX(release_date) FROM country_indicators
        WHERE parent_currency_id = ?
        ${countryCode ? " AND country_code = ?" : ""}
        GROUP BY country_code, indicator_name
      )`;
      params.push(Number(parentCurrencyId));
      if (countryCode) params.push(countryCode);
    }

    query += " ORDER BY country_code, category, name";
    const rows = db.prepare(query).all(...params);
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { parentCurrencyId, countryCode, countryName, name, category, previous, forecast, actual, sigma, sign, weight, releaseDate } = body;
    if (!parentCurrencyId || !countryCode || !countryName || !name || !category || sign === undefined || weight === undefined || !releaseDate) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }
    const stmt = db.prepare(
      `INSERT INTO country_indicators (parent_currency_id, country_code, country_name, indicator_name, category, previous, forecast, actual, sigma, sign, weight, release_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(parent_currency_id, country_code, indicator_name, release_date) DO UPDATE SET
         previous=excluded.previous, forecast=excluded.forecast, actual=excluded.actual, sigma=excluded.sigma, updated_at=unixepoch()`
    );
    const result = stmt.run(
      parentCurrencyId,
      countryCode,
      countryName,
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
