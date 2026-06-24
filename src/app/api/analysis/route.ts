import { NextResponse } from "next/server";
import db from "@/lib/db";
import { analyzeCurrency, generatePairSignals } from "@/lib/macro";
import { IndicatorInput, MarketPositioning, MacroAnalysis } from "@/lib/types";

export async function GET() {
  try {
    const currencies = db.prepare("SELECT id, code, name FROM currencies ORDER BY code").all() as {
      id: number;
      code: string;
      name: string;
    }[];

    if (currencies.length === 0) {
      return NextResponse.json({ analyses: [], pairs: [] });
    }

    const mpRow = db
      .prepare(
        "SELECT id, cot_spx_net_spec as cotSpxNetSpec, cot_usd_net_spec as cotUsdNetSpec, vix_level as vixLevel, retail_sentiment as retailSentiment FROM market_positioning LIMIT 1"
      )
      .get() as MarketPositioning | undefined;

    const mp: MarketPositioning = mpRow ?? {
      id: 1,
      cotSpxNetSpec: 0,
      cotUsdNetSpec: 0,
      vixLevel: 20,
      retailSentiment: "neutral",
    };

    const analyses: MacroAnalysis[] = [];

    for (const cur of currencies) {
      const rows = db
        .prepare(
          `SELECT id, currency_id as currencyId, indicator_name as name, category, previous, forecast, actual, sigma, sign, weight, release_date as releaseDate
           FROM indicator_data WHERE currency_id = ?
           AND (indicator_name, release_date) IN (
             SELECT indicator_name, MAX(release_date) FROM indicator_data WHERE currency_id = ? GROUP BY indicator_name
           )`
        )
        .all(cur.id, cur.id) as IndicatorInput[];

      const analysis = analyzeCurrency(cur.id, cur.code, rows, mp);
      analyses.push(analysis);
    }

    const pairs = generatePairSignals(analyses);

    return NextResponse.json({ analyses, pairs });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
