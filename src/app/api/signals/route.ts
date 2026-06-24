import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, exitPrice } = body;
    if (!id || exitPrice === undefined) {
      return NextResponse.json({ error: "id and exitPrice required" }, { status: 400 });
    }

    const row = db
      .prepare("SELECT signal, entry_price FROM signal_snapshots WHERE id = ?")
      .get(id) as { signal: string; entry_price: number } | undefined;
    if (!row) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (row.entry_price === 0) {
      return NextResponse.json({ error: "entry_price is 0" }, { status: 400 });
    }

    const returnPct = ((exitPrice - row.entry_price) / row.entry_price) * 100;
    const directionalReturn = row.signal === "SELL" ? -returnPct : returnPct;
    let result = "NEUTRAL";
    if (directionalReturn > 0.1) result = "WIN";
    else if (directionalReturn < -0.1) result = "LOSS";

    db.prepare(
      "UPDATE signal_snapshots SET exit_price = ?, return_pct = ?, result = ? WHERE id = ?"
    ).run(exitPrice, directionalReturn, result, id);

    return NextResponse.json({ success: true, returnPct: directionalReturn, result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
