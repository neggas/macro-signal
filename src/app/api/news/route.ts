import { NextResponse } from "next/server";
import {
  fetchGeneralNews,
  fetchCryptoNews,
  fetchForexNews,
  fetchFMPArticles,
  type FMPNewsArticle,
  type FMPArticle,
} from "@/lib/fmp";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? "all";
  const page = parseInt(searchParams.get("page") ?? "0", 10);
  const limit = parseInt(searchParams.get("limit") ?? "30", 10);

  try {
    if (category === "all") {
      const [general, crypto, forex, fmp] = await Promise.all([
        fetchGeneralNews(0, 15).catch(() => [] as FMPNewsArticle[]),
        fetchCryptoNews(0, 15).catch(() => [] as FMPNewsArticle[]),
        fetchForexNews(0, 15).catch(() => [] as FMPNewsArticle[]),
        fetchFMPArticles(0, 10).catch(() => [] as FMPArticle[]),
      ]);

      return NextResponse.json({
        general,
        crypto,
        forex,
        fmpArticles: fmp,
      });
    }

    if (category === "general") {
      const articles = await fetchGeneralNews(page, limit);
      return NextResponse.json({ general: articles });
    }

    if (category === "crypto") {
      const articles = await fetchCryptoNews(page, limit);
      return NextResponse.json({ crypto: articles });
    }

    if (category === "forex") {
      const articles = await fetchForexNews(page, limit);
      return NextResponse.json({ forex: articles });
    }

    if (category === "fmp") {
      const articles = await fetchFMPArticles(page, limit);
      return NextResponse.json({ fmpArticles: articles });
    }

    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
