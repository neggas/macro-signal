import { NextResponse } from "next/server";
import db from "@/lib/db";
import { mapApiName, SUPPORTED_CURRENCIES } from "@/lib/indicator-map";
import { parseFFValue } from "@/lib/ff-value";

const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

interface FFEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
}

export async function GET() {
  try {
    const rows = db
      .prepare(
        `SELECT id, synced_at, period, events_fetched, events_mapped, events_saved, status, error
         FROM sync_log ORDER BY synced_at DESC LIMIT 30`
      )
      .all();
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const debug = searchParams.get("debug") === "true";
  const includeAll = searchParams.get("all") === "true";

  let eventsFetched = 0;
  let eventsMapped = 0;
  let eventsSaved = 0;
  const details: string[] = [];

  try {
    const res = await fetch(FF_URL, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API error ${res.status}: ${body}`);
    }

    const rawBody = await res.text();
    let events: FFEvent[];
    try {
      events = JSON.parse(rawBody);
      if (!Array.isArray(events)) {
        throw new Error(`Unexpected API response (not an array): ${rawBody.slice(0, 200)}`);
      }
    } catch (parseErr) {
      throw new Error(`Parse error: ${(parseErr as Error).message}`);
    }

    if (debug) {
      return NextResponse.json({ debug: true, count: events.length, raw: events.slice(0, 5) });
    }

    const filteredEvents = includeAll
      ? events
      : events.filter((e) => e.impact === "High" || e.impact === "Medium");

    eventsFetched = filteredEvents.length;

    const currencies = db
      .prepare("SELECT id, code FROM currencies")
      .all() as { id: number; code: string }[];
    const currencyMap = new Map(currencies.map((c) => [c.code, c.id]));

    const templates = db
      .prepare("SELECT indicator_name, category, sign, weight FROM indicator_templates")
      .all() as { indicator_name: string; category: string; sign: number; weight: number }[];
    const templateMap = new Map(templates.map((t) => [t.indicator_name, t]));

    const upsert = db.prepare(
      `INSERT INTO indicator_data (currency_id, indicator_name, category, previous, forecast, actual, sigma, sign, weight, release_date)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
       ON CONFLICT(currency_id, indicator_name, release_date) DO UPDATE SET
         previous=excluded.previous, forecast=excluded.forecast, actual=excluded.actual, updated_at=unixepoch()`
    );

    const upsertMany = db.transaction((evts: FFEvent[]) => {
      for (const evt of evts) {
        const currencyCode = evt.country?.toUpperCase();
        if (!SUPPORTED_CURRENCIES.includes(currencyCode)) continue;

        const currencyId = currencyMap.get(currencyCode);
        if (!currencyId) continue;

        const internalName = mapApiName(evt.title);
        if (!internalName) continue;

        eventsMapped++;

        const tmpl = templateMap.get(internalName);
        if (!tmpl) continue;

        const releaseDate = evt.date
          ? evt.date.split("T")[0]
          : new Date().toISOString().split("T")[0];

        const previous = parseFFValue(evt.previous);
        const forecast = parseFFValue(evt.forecast);
        const actual = 0;

        upsert.run(
          currencyId,
          internalName,
          tmpl.category,
          previous,
          forecast,
          actual,
          tmpl.sign,
          tmpl.weight,
          releaseDate
        );
        eventsSaved++;
        details.push(
          `${currencyCode} / ${internalName} (${releaseDate}) [${evt.impact}] prev=${previous} fcst=${forecast}`
        );
      }
    });

    upsertMany(filteredEvents);

    db.prepare(
      `INSERT INTO sync_log (period, events_fetched, events_mapped, events_saved, status)
       VALUES (?, ?, ?, ?, 'ok')`
    ).run("ff_thisweek", eventsFetched, eventsMapped, eventsSaved);

    return NextResponse.json({
      success: true,
      period: "ff_thisweek",
      eventsFetched,
      eventsMapped,
      eventsSaved,
      details,
    });
  } catch (err) {
    const message = (err as Error).message;
    db.prepare(
      `INSERT INTO sync_log (period, events_fetched, events_mapped, events_saved, status, error)
       VALUES (?, ?, ?, ?, 'error', ?)`
    ).run("ff_thisweek", eventsFetched, eventsMapped, eventsSaved, message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
