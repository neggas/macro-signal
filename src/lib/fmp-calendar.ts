import db from "@/lib/db";
import { mapApiName, SUPPORTED_CURRENCIES } from "@/lib/indicator-map";
import { fetchEconomicCalendar, type FMPCalendarEvent } from "@/lib/fmp";

export interface FMPCalendarSyncResult {
  eventsFetched: number;
  eventsMapped: number;
  eventsSaved: number;
  details: string[];
  source: "fmp";
}

function fmpImpact(impact: string): "high" | "medium" | "low" {
  const i = impact.toLowerCase();
  if (i === "high") return "high";
  if (i === "medium") return "medium";
  return "low";
}

/**
 * Fetch economic calendar events from FMP within a date range.
 * Optionally filter by country code (e.g. "US", "EU").
 */
export async function fetchFMPCalendar(
  from: string,
  to: string,
  country?: string
): Promise<FMPCalendarEvent[]> {
  const events = await fetchEconomicCalendar(from, to, country);
  if (!Array.isArray(events)) {
    throw new Error("Unexpected FMP calendar response (not an array)");
  }
  return events;
}

/**
 * Sync FMP calendar events into the economic_events table.
 * Filters by supported currencies and maps event names to internal indicator names.
 */
export function syncFMPEventsToDb(
  events: FMPCalendarEvent[],
  options: { includeAll?: boolean } = {}
): FMPCalendarSyncResult {
  const filtered = options.includeAll
    ? events
    : events.filter(
        (e) =>
          e.impact === "High" ||
          e.impact === "Medium"
      );

  const details: string[] = [];
  let eventsMapped = 0;
  let eventsSaved = 0;

  const upsert = db.prepare(
    `INSERT INTO economic_events
       (source, currency_code, event_name, indicator_name, impact, event_time, release_date, previous, forecast, actual, unit)
     VALUES ('fmp', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(source, currency_code, event_name, event_time) DO UPDATE SET
       indicator_name=excluded.indicator_name, impact=excluded.impact,
       previous=excluded.previous, forecast=excluded.forecast,
       actual=COALESCE(excluded.actual, economic_events.actual),
       unit=excluded.unit, updated_at=unixepoch()`
  );

  const upsertMany = db.transaction((evts: FMPCalendarEvent[]) => {
    for (const evt of evts) {
      const currencyCode = evt.currency?.toUpperCase();
      if (!currencyCode || !SUPPORTED_CURRENCIES.includes(currencyCode)) continue;

      const internalName = mapApiName(evt.event);
      if (!internalName) continue;

      eventsMapped++;

      const releaseDate = evt.date
        ? evt.date.split(" ")[0].split("T")[0]
        : new Date().toISOString().split("T")[0];
      const eventTime = evt.date ?? `${releaseDate}T00:00:00`;
      const previous = evt.previous ?? 0;
      const forecast = evt.estimate ?? 0;
      const actual = evt.actual;
      const unit = evt.unit ?? null;

      upsert.run(
        currencyCode,
        evt.event,
        internalName,
        fmpImpact(evt.impact),
        eventTime,
        releaseDate,
        previous,
        forecast,
        actual,
        unit
      );
      eventsSaved++;
      details.push(
        `${currencyCode} / ${internalName} (${releaseDate}) [${evt.impact}] prev=${previous} fcst=${forecast}${actual !== null ? ` act=${actual}` : ""}${unit ? ` unit=${unit}` : ""}`
      );
    }
  });

  upsertMany(filtered);

  return {
    eventsFetched: filtered.length,
    eventsMapped,
    eventsSaved,
    details,
    source: "fmp",
  };
}
