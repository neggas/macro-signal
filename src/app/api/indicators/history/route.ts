import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const currencyId = searchParams.get("currencyId");
    const indicatorName = searchParams.get("indicatorName");
    if (!currencyId || !indicatorName) {
      return NextResponse.json({ error: "currencyId and indicatorName required" }, { status: 400 });
    }
    const rows = db
      .prepare(
        `SELECT id, previous, forecast, actual, sigma, release_date as releaseDate, updated_at as updatedAt
         FROM indicator_data WHERE currency_id = ? AND indicator_name = ? ORDER BY release_date DESC`
      )
      .all(Number(currencyId), indicatorName);
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
