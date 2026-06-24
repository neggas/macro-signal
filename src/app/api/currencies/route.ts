import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const rows = db.prepare("SELECT id, code, name FROM currencies ORDER BY code").all();
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, name } = body;
    if (!code || !name) {
      return NextResponse.json({ error: "code and name required" }, { status: 400 });
    }
    const stmt = db.prepare("INSERT INTO currencies (code, name) VALUES (?, ?)");
    const result = stmt.run(code.toUpperCase(), name);
    const id = result.lastInsertRowid;

    // Seed indicator templates for this currency
    const templates = db
      .prepare("SELECT indicator_name, category, sign, weight FROM indicator_templates")
      .all() as { indicator_name: string; category: string; sign: number; weight: number }[];

    const insertInd = db.prepare(
      "INSERT INTO indicator_data (currency_id, indicator_name, category, sign, weight) VALUES (?, ?, ?, ?, ?)"
    );
    for (const t of templates) {
      insertInd.run(id, t.indicator_name, t.category, t.sign, t.weight);
    }

    return NextResponse.json({ id, code: code.toUpperCase(), name });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
