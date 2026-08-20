import db from "@/lib/db";
import {
  fetchEconomicIndicator,
  type FMPIndicatorName,
  type FMPIndicatorPoint,
} from "@/lib/fmp";

export interface FMPIndicatorSyncResult {
  indicator: string;
  internalName: string;
  pointsFetched: number;
  pointsSaved: number;
  source: "fmp";
}

interface FMPIndicatorMapping {
  fmpName: FMPIndicatorName;
  internalName: string;
  category: "Growth" | "Inflation" | "Labor";
  sign: number;
  weight: number;
}

const USD_CURRENCY_CODE = "USD";

const INDICATOR_MAPPINGS: FMPIndicatorMapping[] = [
  { fmpName: "GDP", internalName: "GDP", category: "Growth", sign: 1, weight: 0.30 },
  { fmpName: "CPI", internalName: "CPI", category: "Inflation", sign: 1, weight: 0.40 },
  { fmpName: "retailSales", internalName: "Retail Sales", category: "Growth", sign: 1, weight: 0.20 },
  { fmpName: "durableGoods", internalName: "Durable Goods Orders", category: "Growth", sign: 1, weight: 0.10 },
  { fmpName: "unemploymentRate", internalName: "Unemployment Rate", category: "Labor", sign: -1, weight: 0.30 },
  { fmpName: "totalNonfarmPayroll", internalName: "NFP", category: "Labor", sign: 1, weight: 0.50 },
  { fmpName: "initialClaims", internalName: "Jobless Claims", category: "Labor", sign: -1, weight: 0.20 },
  { fmpName: "industrialProductionTotalIndex", internalName: "Industrial Production", category: "Growth", sign: 1, weight: 0.15 },
];

/**
 * Sync FMP economic indicators (historical time series) into indicator_data.
 * These are US-only macro indicators. Data is stored with source='fmp'.
 */
export async function syncFMPIndicators(
  from?: string,
  to?: string
): Promise<FMPIndicatorSyncResult[]> {
  const usdCurrency = db
    .prepare("SELECT id FROM currencies WHERE code = 'USD'")
    .get() as { id: number } | undefined;

  if (!usdCurrency) {
    throw new Error("USD currency not found in database. Add USD first via POST /api/currencies.");
  }

  const results: FMPIndicatorSyncResult[] = [];

  for (const mapping of INDICATOR_MAPPINGS) {
    try {
      const points = await fetchEconomicIndicator(mapping.fmpName, from, to);
      const result = syncFMPIndicatorPoints(usdCurrency.id, mapping, points);
      results.push(result);
    } catch (err) {
      results.push({
        indicator: mapping.fmpName,
        internalName: mapping.internalName,
        pointsFetched: 0,
        pointsSaved: 0,
        source: "fmp",
      });
      console.error(`Failed to sync FMP indicator ${mapping.fmpName}:`, err);
    }
  }

  return results;
}

function syncFMPIndicatorPoints(
  currencyId: number,
  mapping: FMPIndicatorMapping,
  points: FMPIndicatorPoint[]
): FMPIndicatorSyncResult {
  let pointsSaved = 0;

  const upsert = db.prepare(
    `INSERT INTO indicator_data
       (currency_id, indicator_name, category, previous, forecast, actual, sigma, sign, weight, release_date, source)
     VALUES (?, ?, ?, 0, 0, ?, 0, ?, ?, ?, 'fmp')
     ON CONFLICT(currency_id, indicator_name, release_date) DO UPDATE SET
       actual=excluded.actual, source='fmp', updated_at=unixepoch()`
  );

  const upsertMany = db.transaction((pts: FMPIndicatorPoint[]) => {
    for (const pt of pts) {
      if (!Number.isFinite(pt.value)) continue;
      const releaseDate = pt.date?.split("T")[0] ?? new Date().toISOString().split("T")[0];
      upsert.run(
        currencyId,
        mapping.internalName,
        mapping.category,
        pt.value,
        mapping.sign,
        mapping.weight,
        releaseDate
      );
      pointsSaved++;
    }
  });

  upsertMany(points);

  return {
    indicator: mapping.fmpName,
    internalName: mapping.internalName,
    pointsFetched: points.length,
    pointsSaved,
    source: "fmp",
  };
}
