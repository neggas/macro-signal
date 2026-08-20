import { NextResponse } from "next/server";
import db from "@/lib/db";
import { syncFMPTreasuryRates } from "@/lib/fmp-treasury";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  try {
    const result = await syncFMPTreasuryRates(from, to);

    db.prepare(
      `INSERT INTO sync_log (period, events_fetched, events_mapped, events_saved, status)
       VALUES (?, ?, ?, ?, 'ok')`
    ).run("fmp_treasury", result.ratesFetched, result.ratesFetched, result.ratesSaved);

    return NextResponse.json({
      success: true,
      period: "fmp_treasury",
      from: from ?? "default",
      to: to ?? "default",
      ...result,
    });
  } catch (err) {
    const message = (err as Error).message;
    db.prepare(
      `INSERT INTO sync_log (period, events_fetched, events_mapped, events_saved, status, error)
       VALUES ('fmp_treasury', 0, 0, 0, 'error', ?)`
    ).run(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
