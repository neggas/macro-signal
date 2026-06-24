import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const row = db
      .prepare(
        "SELECT id, cot_spx_net_spec as cotSpxNetSpec, cot_usd_net_spec as cotUsdNetSpec, vix_level as vixLevel, retail_sentiment as retailSentiment FROM market_positioning LIMIT 1"
      )
      .get();
    return NextResponse.json(row);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { cotSpxNetSpec, cotUsdNetSpec, vixLevel, retailSentiment } = body;
    const row = db.prepare("SELECT id FROM market_positioning LIMIT 1").get() as { id: number } | undefined;
    if (!row) {
      db.prepare(
        "INSERT INTO market_positioning (cot_spx_net_spec, cot_usd_net_spec, vix_level, retail_sentiment) VALUES (?, ?, ?, ?)"
      ).run(
        cotSpxNetSpec ?? 0,
        cotUsdNetSpec ?? 0,
        vixLevel ?? 20,
        retailSentiment ?? "neutral"
      );
    } else {
      db.prepare(
        "UPDATE market_positioning SET cot_spx_net_spec = ?, cot_usd_net_spec = ?, vix_level = ?, retail_sentiment = ?, updated_at = unixepoch() WHERE id = ?"
      ).run(
        cotSpxNetSpec ?? 0,
        cotUsdNetSpec ?? 0,
        vixLevel ?? 20,
        retailSentiment ?? "neutral",
        row.id
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
