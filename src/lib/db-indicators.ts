import db from "@/lib/db";
import { mergeIndicatorInputs, type CalendarEventRow, type ActualDataRow } from "@/lib/indicator-merge";
import { estimateSigma } from "@/lib/sigma";
import type { IndicatorInput } from "@/lib/types";

interface HistoryRow {
  indicatorName: string;
  forecast: number;
  actual: number | null;
  releaseDate: string;
}

/**
 * Build a per-indicator sigma map from historical releases of this currency.
 * Surprises (actual - forecast) feed the preferred estimator; the bare series
 * of actuals feeds the change-volatility fallback. See sigma.ts.
 */
function computeSigmaMap(currencyId: number, currencyCode: string): Map<string, number> {
  // Published actuals (FRED + manual) across all release dates.
  const actualHistory = db
    .prepare(
      `SELECT indicator_name as indicatorName, forecast, actual, release_date as releaseDate
       FROM indicator_data
       WHERE currency_id = ? AND source IN ('fred', 'manual', 'fmp')
       ORDER BY indicator_name, release_date ASC`
    )
    .all(currencyId) as HistoryRow[];

  // Calendar history carries both forecast and (once released) actual → surprises.
  const calendarHistory = db
    .prepare(
      `SELECT indicator_name as indicatorName, forecast, actual, release_date as releaseDate
       FROM economic_events
       WHERE currency_code = ? AND indicator_name IS NOT NULL AND actual IS NOT NULL
       ORDER BY indicator_name, release_date ASC`
    )
    .all(currencyCode) as HistoryRow[];

  const valuesByIndicator = new Map<string, number[]>();
  const surprisesByIndicator = new Map<string, number[]>();

  const pushValue = (name: string, v: number) => {
    const arr = valuesByIndicator.get(name) ?? [];
    arr.push(v);
    valuesByIndicator.set(name, arr);
  };
  const pushSurprise = (name: string, s: number) => {
    const arr = surprisesByIndicator.get(name) ?? [];
    arr.push(s);
    surprisesByIndicator.set(name, arr);
  };

  for (const row of actualHistory) {
    if (row.actual === null || !Number.isFinite(row.actual)) continue;
    pushValue(row.indicatorName, row.actual);
    if (row.forecast !== 0) pushSurprise(row.indicatorName, row.actual - row.forecast);
  }

  for (const row of calendarHistory) {
    if (row.actual === null || !Number.isFinite(row.actual)) continue;
    pushValue(row.indicatorName, row.actual);
    pushSurprise(row.indicatorName, row.actual - row.forecast);
  }

  const sigmaMap = new Map<string, number>();
  const names = new Set<string>([...valuesByIndicator.keys(), ...surprisesByIndicator.keys()]);
  for (const name of names) {
    const est = estimateSigma({
      surprises: surprisesByIndicator.get(name),
      values: valuesByIndicator.get(name),
    });
    if (est) sigmaMap.set(name, est.sigma);
  }
  return sigmaMap;
}

export function getMergedIndicatorsForCurrency(currencyId: number, currencyCode: string): IndicatorInput[] {
  const templates = db
    .prepare("SELECT indicator_name, category, sign, weight FROM indicator_templates")
    .all() as { indicator_name: string; category: string; sign: number; weight: number }[];

  const calendarRows = db
    .prepare(
      `SELECT indicator_name as indicatorName, currency_code as currencyCode,
              previous, forecast, actual, release_date as releaseDate, impact, event_name as eventName
       FROM economic_events WHERE currency_code = ?`
    )
    .all(currencyCode) as CalendarEventRow[];

  const actualRows = db
    .prepare(
      `SELECT id, currency_id as currencyId, indicator_name as name, category,
              previous, forecast, actual, sigma, sign, weight, release_date as releaseDate,
              COALESCE(source, 'manual') as source
       FROM indicator_data WHERE currency_id = ?
       AND (indicator_name, release_date) IN (
         SELECT indicator_name, MAX(release_date) FROM indicator_data WHERE currency_id = ? GROUP BY indicator_name
       )`
    )
    .all(currencyId, currencyId) as ActualDataRow[];

  const merged = mergeIndicatorInputs(currencyId, currencyCode, templates, calendarRows, actualRows);

  // Inject historically-derived sigma where no explicit (manual) sigma was set.
  // A non-zero stored sigma always wins; macro.ts falls back to approxSigma when
  // both the stored and the historical sigma are unavailable.
  const sigmaMap = computeSigmaMap(currencyId, currencyCode);
  for (const input of merged) {
    if (input.sigma > 0) continue;
    const historical = sigmaMap.get(input.name);
    if (historical && historical > 0) input.sigma = historical;
  }

  return merged;
}
