/**
 * Maps API event names (from JBlanked/MQL5/ForexFactory) to internal indicator names.
 * Rules are ordered by priority — first match wins.
 */

const RULES: Array<{
  test: (name: string) => boolean;
  internalName: string;
}> = [
  // Core PCE — must come before generic CPI
  {
    test: (n) => /core\s*pce|pce\s*price/i.test(n),
    internalName: "Core PCE",
  },
  // PPI / Producer prices
  {
    test: (n) => /\bppi\b|producer\s*price/i.test(n),
    internalName: "PPI",
  },
  // Jobless Claims — must come before Unemployment Rate
  {
    test: (n) => /jobless\s*claims|initial\s*(jobless\s*)?claims|continuing\s*claims|unemployment\s*claims/i.test(n),
    internalName: "Jobless Claims",
  },
  // Unemployment Rate (but not NAB Quarterly Business Confidence)
  {
    test: (n) => /unemployment\s*rate|jobless\s*rate/i.test(n),
    internalName: "Unemployment Rate",
  },
  // NFP — must come before generic "Employment"
  {
    test: (n) => /non.farm|nonfarm|\bnfp\b/i.test(n),
    internalName: "NFP",
  },
  // Employment Change (AUD, CAD, NZD equivalent of NFP)
  {
    test: (n) => /employment\s*change/i.test(n),
    internalName: "NFP",
  },
  // PMI Manufacturing
  {
    test: (n) =>
      /manufacturing\s*(pmi|index)/i.test(n) ||
      /\bism\s*(manufacturing|mfg)/i.test(n) ||
      (/\bpmi\b/i.test(n) && /manufactur/i.test(n)) ||
      /flash\s*manufacturing\s*pmi/i.test(n),
    internalName: "PMI Manufacturing",
  },
  // PMI Services / Composite
  {
    test: (n) =>
      /services?\s*(pmi|index)/i.test(n) ||
      /ism\s*non.manufactur/i.test(n) ||
      /composite\s*pmi/i.test(n) ||
      (/\bpmi\b/i.test(n) && /service/i.test(n)) ||
      /flash\s*services\s*pmi/i.test(n),
    internalName: "PMI Services",
  },
  // Retail Sales
  {
    test: (n) => /retail\s*sales/i.test(n),
    internalName: "Retail Sales",
  },
  // Industrial Production
  {
    test: (n) => /industrial\s*prod/i.test(n),
    internalName: "Industrial Production",
  },
  // Richmond / Empire / Philly Manufacturing — map to Industrial Production as a proxy
  {
    test: (n) => /richmond\s*manufactur|empire\s*state\s*manufactur|philly\s*fed\s*manufactur/i.test(n),
    internalName: "Industrial Production",
  },
  // CPI (general — catches CPI m/m, CPI y/y, Core CPI, Trimmed CPI, Inflation Rate, HICP)
  {
    test: (n) => /\bcpi\b|consumer\s*price|inflation\s*rate|\bhicp\b|trimmed\s*cpi/i.test(n),
    internalName: "CPI",
  },
  // GDP
  {
    test: (n) => /\bgdp\b/i.test(n),
    internalName: "GDP",
  },
  // Durable Goods Orders
  {
    test: (n) => /durable\s*goods/i.test(n),
    internalName: "Durable Goods Orders",
  },
  // Personal Income / Spending
  {
    test: (n) => /personal\s*(income|spending)/i.test(n),
    internalName: "Personal Income",
  },
];

export function mapApiName(apiName: string): string | null {
  for (const rule of RULES) {
    if (rule.test(apiName)) return rule.internalName;
  }
  return null;
}

/** Supported currency codes in our DB */
export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"];
