import type { IndicatorInput } from "./types";

export interface CalendarEventRow {
  indicatorName: string | null;
  currencyCode: string;
  previous: number;
  forecast: number;
  actual: number | null;
  releaseDate: string;
  impact: string;
  eventName: string;
}

export interface ActualDataRow {
  id: number;
  currencyId: number;
  name: string;
  category: string;
  previous: number;
  forecast: number;
  actual: number;
  sigma: number;
  sign: number;
  weight: number;
  releaseDate: string;
  source: string;
}

export interface IndicatorTemplateRow {
  indicator_name: string;
  category: string;
  sign: number;
  weight: number;
}

/**
 * Merge calendar forecasts (Finnhub/FF) with published actuals (FRED/manual).
 * Calendar never overwrites FRED actuals; forecasts come from the latest calendar row.
 */
export function mergeIndicatorInputs(
  currencyId: number,
  currencyCode: string,
  templates: IndicatorTemplateRow[],
  calendarRows: CalendarEventRow[],
  actualRows: ActualDataRow[]
): IndicatorInput[] {
  const calendarByIndicator = new Map<string, CalendarEventRow>();
  for (const row of calendarRows) {
    if (!row.indicatorName) continue;
    const existing = calendarByIndicator.get(row.indicatorName);
    if (!existing || row.releaseDate > existing.releaseDate) {
      calendarByIndicator.set(row.indicatorName, row);
    }
  }

  const actualByIndicator = new Map<string, ActualDataRow>();
  for (const row of actualRows) {
    const existing = actualByIndicator.get(row.name);
    if (!existing || row.releaseDate > existing.releaseDate) {
      actualByIndicator.set(row.name, row);
    }
  }

  const results: IndicatorInput[] = [];

  for (const tmpl of templates) {
    const cal = calendarByIndicator.get(tmpl.indicator_name);
    const act = actualByIndicator.get(tmpl.indicator_name);

    const previous = cal?.previous ?? act?.previous ?? 0;
    const forecast = cal?.forecast ?? act?.forecast ?? 0;

    let actual = 0;
    let released = false;

    if (act?.source === "fred" || act?.source === "fmp") {
      actual = act.actual;
      released = true;
    } else if (act?.source === "manual") {
      actual = act.actual;
      released = act.actual !== 0 || act.sigma > 0;
    } else if (cal?.actual !== null && cal?.actual !== undefined) {
      actual = cal.actual;
      released = true;
    }

    // Prefer actual row metadata when present
    const sigma = act?.sigma ?? 0;
    const sign = act?.sign ?? tmpl.sign;
    const weight = act?.weight ?? tmpl.weight;
    const releaseDate = act?.releaseDate ?? cal?.releaseDate;
    const id = act?.id ?? 0;

    results.push({
      id,
      currencyId,
      name: tmpl.indicator_name,
      category: tmpl.category as IndicatorInput["category"],
      previous,
      forecast,
      actual,
      sigma,
      sign,
      weight,
      releaseDate,
      released,
      source: act?.source ?? (cal ? "calendar" : "none"),
    });
  }

  // Include orphan actuals not in templates (manual extras)
  for (const [name, act] of actualByIndicator) {
    if (templates.some((t) => t.indicator_name === name)) continue;
    results.push({
      id: act.id,
      currencyId,
      name: act.name,
      category: act.category as IndicatorInput["category"],
      previous: act.previous,
      forecast: act.forecast,
      actual: act.actual,
      sigma: act.sigma,
      sign: act.sign,
      weight: act.weight,
      releaseDate: act.releaseDate,
      released: act.source === "fred" || act.actual !== 0,
      source: act.source,
    });
  }

  void currencyCode;
  return results;
}
