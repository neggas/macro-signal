const FMP_BASE_URL = "https://financialmodelingprep.com/stable";

function getApiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) {
    throw new Error(
      "FMP_API_KEY is not set. Add it to .env.local or your environment."
    );
  }
  return key;
}

/**
 * Generic FMP fetch wrapper. Automatically appends the API key.
 */
async function fmpFetch<T>(
  path: string,
  params: Record<string, string | undefined> = {}
): Promise<T> {
  const apiKey = getApiKey();
  const url = new URL(`${FMP_BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`FMP API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const rawBody = await res.text();
  const data = JSON.parse(rawBody) as T;

  if (typeof data === "object" && data !== null && "Error Message" in data) {
    throw new Error(`FMP API error: ${(data as { "Error Message": string })["Error Message"]}`);
  }

  return data;
}

/* ── Economic Calendar ────────────────────────────────────────────── */

export interface FMPCalendarEvent {
  date: string;
  country: string;
  event: string;
  currency: string;
  previous: number | null;
  estimate: number | null;
  actual: number | null;
  change: number | null;
  impact: string;
  changePercentage: number | null;
  unit: string | null;
}

export async function fetchEconomicCalendar(
  from: string,
  to: string,
  country?: string
): Promise<FMPCalendarEvent[]> {
  return fmpFetch<FMPCalendarEvent[]>("economic-calendar", { from, to, country });
}

/* ── Economic Indicators (time series) ────────────────────────────── */

export interface FMPIndicatorPoint {
  name: string;
  date: string;
  value: number;
}

export type FMPIndicatorName =
  | "GDP"
  | "realGDP"
  | "nominalPotentialGDP"
  | "realGDPPerCapita"
  | "federalFunds"
  | "CPI"
  | "inflationRate"
  | "inflation"
  | "retailSales"
  | "consumerSentiment"
  | "durableGoods"
  | "unemploymentRate"
  | "totalNonfarmPayroll"
  | "initialClaims"
  | "industrialProductionTotalIndex"
  | "newPrivatelyOwnedHousingUnitsStartedTotalUnits"
  | "totalVehicleSales"
  | "retailMoneyFunds"
  | "smoothedUSRecessionProbabilities"
  | "3MonthOr90DayRatesAndYieldsCertificatesOfDeposit"
  | "commercialBankInterestRateOnCreditCardPlansAllAccounts"
  | "30YearFixedRateMortgageAverage"
  | "15YearFixedRateMortgageAverage"
  | "tradeBalanceGoodsAndServices";

export async function fetchEconomicIndicator(
  name: FMPIndicatorName,
  from?: string,
  to?: string
): Promise<FMPIndicatorPoint[]> {
  return fmpFetch<FMPIndicatorPoint[]>("economic-indicators", { name, from, to });
}

/* ── Treasury Rates ───────────────────────────────────────────────── */

export interface FMPTreasuryRate {
  date: string;
  month1: number;
  month2: number;
  month3: number;
  month6: number;
  year1: number;
  year2: number;
  year3: number;
  year5: number;
  year7: number;
  year10: number;
  year20: number;
  year30: number;
}

export async function fetchTreasuryRates(
  from?: string,
  to?: string
): Promise<FMPTreasuryRate[]> {
  return fmpFetch<FMPTreasuryRate[]>("treasury-rates", { from, to });
}

/* ── Market Risk Premium ──────────────────────────────────────────── */

export interface FMPMarketRiskPremium {
  country: string;
  continent: string;
  countryRiskPremium: number;
  totalEquityRiskPremium: number;
}

export async function fetchMarketRiskPremium(): Promise<FMPMarketRiskPremium[]> {
  return fmpFetch<FMPMarketRiskPremium[]>("market-risk-premium");
}

/* ── News ─────────────────────────────────────────────────────────── */

export interface FMPNewsArticle {
  symbol: string | null;
  publishedDate: string;
  publisher: string;
  title: string;
  image: string | null;
  site: string;
  text: string;
  url: string;
}

export interface FMPArticle {
  title: string;
  date: string;
  content: string;
  tickers: string | null;
  image: string | null;
  link: string;
  author: string;
  site: string;
}

export async function fetchGeneralNews(
  page = 0,
  limit = 20,
  from?: string,
  to?: string
): Promise<FMPNewsArticle[]> {
  return fmpFetch<FMPNewsArticle[]>("news/general-latest", { page: String(page), limit: String(limit), from, to });
}

export async function fetchCryptoNews(
  page = 0,
  limit = 20,
  from?: string,
  to?: string
): Promise<FMPNewsArticle[]> {
  return fmpFetch<FMPNewsArticle[]>("news/crypto-latest", { page: String(page), limit: String(limit), from, to });
}

export async function fetchForexNews(
  page = 0,
  limit = 20,
  from?: string,
  to?: string
): Promise<FMPNewsArticle[]> {
  return fmpFetch<FMPNewsArticle[]>("news/forex-latest", { page: String(page), limit: String(limit), from, to });
}

export async function fetchStockNews(
  page = 0,
  limit = 20,
  from?: string,
  to?: string
): Promise<FMPNewsArticle[]> {
  return fmpFetch<FMPNewsArticle[]>("news/stock-latest", { page: String(page), limit: String(limit), from, to });
}

export async function fetchFMPArticles(
  page = 0,
  limit = 20
): Promise<FMPArticle[]> {
  return fmpFetch<FMPArticle[]>("fmp-articles", { page: String(page), limit: String(limit) });
}

export async function searchCryptoNews(
  symbols: string,
  page = 0,
  limit = 20,
  from?: string,
  to?: string
): Promise<FMPNewsArticle[]> {
  return fmpFetch<FMPNewsArticle[]>("news/crypto", { symbols, page: String(page), limit: String(limit), from, to });
}

export async function searchForexNews(
  symbols: string,
  page = 0,
  limit = 20,
  from?: string,
  to?: string
): Promise<FMPNewsArticle[]> {
  return fmpFetch<FMPNewsArticle[]>("news/forex", { symbols, page: String(page), limit: String(limit), from, to });
}
