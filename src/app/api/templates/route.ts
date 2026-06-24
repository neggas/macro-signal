import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const rows = db
      .prepare("SELECT indicator_name as name, category, sign, weight FROM indicator_templates ORDER BY category, name")
      .all();
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
