import { NextResponse } from "next/server";
import db from "@/lib/db";
import { SUPPORTED_CURRENCIES } from "@/lib/indicator-map";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const currency = searchParams.get("currency")?.toUpperCase();
    const impact = searchParams.get("impact"); // high, medium, low, or comma-separated

    let query = `
      SELECT id, source, currency_code as currencyCode, event_name as eventName,
             indicator_name as indicatorName, impact, event_time as eventTime,
             release_date as releaseDate, previous, forecast, actual, unit, updated_at as updatedAt
      FROM economic_events WHERE 1=1`;
    const params: unknown[] = [];

    if (from) {
      query += " AND release_date >= ?";
      params.push(from);
    }
    if (to) {
      query += " AND release_date <= ?";
      params.push(to);
    }
    if (currency) {
      query += " AND currency_code = ?";
      params.push(currency);
    }
    if (impact) {
      const levels = impact.split(",").map((s) => s.trim().toLowerCase());
      query += ` AND impact IN (${levels.map(() => "?").join(",")})`;
      params.push(...levels);
    }

    query += " ORDER BY event_time ASC";

    const rows = db.prepare(query).all(...params);
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST() {
  // Return supported currencies for calendar filtering
  return NextResponse.json({ currencies: SUPPORTED_CURRENCIES });
}
