import db from "@/lib/db";
import { fetchTreasuryRates, type FMPTreasuryRate } from "@/lib/fmp";

export interface FMPTreasurySyncResult {
  ratesFetched: number;
  ratesSaved: number;
  source: "fmp";
}

export async function syncFMPTreasuryRates(
  from?: string,
  to?: string
): Promise<FMPTreasurySyncResult> {
  const rates = await fetchTreasuryRates(from, to);
  if (!Array.isArray(rates)) {
    throw new Error("Unexpected FMP treasury rates response (not an array)");
  }

  let ratesSaved = 0;

  const upsert = db.prepare(
    `INSERT INTO treasury_rates
       (date, month1, month2, month3, month6, year1, year2, year3, year5, year7, year10, year20, year30)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       month1=excluded.month1, month2=excluded.month2, month3=excluded.month3,
       month6=excluded.month6, year1=excluded.year1, year2=excluded.year2,
       year3=excluded.year3, year5=excluded.year5, year7=excluded.year7,
       year10=excluded.year10, year20=excluded.year20, year30=excluded.year30`
  );

  const upsertMany = db.transaction((rows: FMPTreasuryRate[]) => {
    for (const row of rows) {
      const date = row.date?.split("T")[0] ?? new Date().toISOString().split("T")[0];
      upsert.run(
        date,
        row.month1, row.month2, row.month3, row.month6,
        row.year1, row.year2, row.year3, row.year5, row.year7,
        row.year10, row.year20, row.year30
      );
      ratesSaved++;
    }
  });

  upsertMany(rates);

  return {
    ratesFetched: rates.length,
    ratesSaved,
    source: "fmp",
  };
}
