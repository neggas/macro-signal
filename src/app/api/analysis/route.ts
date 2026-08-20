import { NextResponse } from "next/server";
import db from "@/lib/db";
import { analyzeCurrency, generatePairSignals } from "@/lib/macro";
import { getMergedIndicatorsForCurrency } from "@/lib/db-indicators";

const NEUTRAL_POSITIONING = {
  id: 1,
  cotSpxNetSpec: 0,
  cotUsdNetSpec: 0,
  vixLevel: 20,
  retailSentiment: "neutral" as const,
};

export async function GET() {
  try {
    const currencies = db
      .prepare("SELECT id, code, name FROM currencies ORDER BY code")
      .all() as { id: number; code: string; name: string }[];

    const analyses = currencies.map((cur) => {
      const indicators = getMergedIndicatorsForCurrency(cur.id, cur.code);
      return analyzeCurrency(cur.id, cur.code, indicators, NEUTRAL_POSITIONING);
    });
    const pairs = generatePairSignals(analyses);

    return NextResponse.json({ analyses, pairs });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
