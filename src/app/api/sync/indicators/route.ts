import { NextResponse } from "next/server";
import db from "@/lib/db";
import { syncFMPIndicators } from "@/lib/fmp-indicators";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  try {
    const results = await syncFMPIndicators(from, to);

    const totalFetched = results.reduce((sum, r) => sum + r.pointsFetched, 0);
    const totalSaved = results.reduce((sum, r) => sum + r.pointsSaved, 0);

    db.prepare(
      `INSERT INTO sync_log (period, events_fetched, events_mapped, events_saved, status)
       VALUES (?, ?, ?, ?, 'ok')`
    ).run("fmp_indicators", totalFetched, totalFetched, totalSaved);

    return NextResponse.json({
      success: true,
      period: "fmp_indicators",
      from: from ?? "default",
      to: to ?? "default",
      totalFetched,
      totalSaved,
      indicators: results,
    });
  } catch (err) {
    const message = (err as Error).message;
    db.prepare(
      `INSERT INTO sync_log (period, events_fetched, events_mapped, events_saved, status, error)
       VALUES ('fmp_indicators', 0, 0, 0, 'error', ?)`
    ).run(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
