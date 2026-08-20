import { NextResponse } from "next/server";
import db from "@/lib/db";
import { fetchFMPCalendar, syncFMPEventsToDb } from "@/lib/fmp-calendar";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeAll = searchParams.get("all") === "true";
  const from = searchParams.get("from") ?? new Date().toISOString().split("T")[0];
  const to = searchParams.get("to") ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const country = searchParams.get("country") ?? undefined;

  try {
    const events = await fetchFMPCalendar(from, to, country);
    const result = syncFMPEventsToDb(events, { includeAll });

    db.prepare(
      `INSERT INTO sync_log (period, events_fetched, events_mapped, events_saved, status)
       VALUES (?, ?, ?, ?, 'ok')`
    ).run("fmp_calendar", result.eventsFetched, result.eventsMapped, result.eventsSaved);

    return NextResponse.json({
      success: true,
      period: "fmp_calendar",
      from,
      to,
      ...result,
    });
  } catch (err) {
    const message = (err as Error).message;
    db.prepare(
      `INSERT INTO sync_log (period, events_fetched, events_mapped, events_saved, status, error)
       VALUES ('fmp_calendar', 0, 0, 0, 'error', ?)`
    ).run(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
