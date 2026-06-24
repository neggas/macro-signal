export type Category = "Growth" | "Inflation" | "Labor";

export interface IndicatorTemplate {
  name: string;
  category: Category;
  sign: number;
  weight: number;
}

export interface IndicatorInput {
  id: number;
  currencyId: number;
  name: string;
  category: Category;
  previous: number;
  forecast: number;
  actual: number;
  sigma: number;
  sign: number;
  weight: number;
  releaseDate?: string;
}

export interface IndicatorResult {
  name: string;
  previous: number;
  forecast: number;
  actual: number;
  sigma: number;
  rawScore: number;
  clampedScore: number;
  finalScore: number;
  weightedScore: number;
}

export interface CategoryScore {
  score: number;
  variance: number;
  indicators: IndicatorResult[];
}

export interface FuzzyResult {
  good: number;
  avg: number;
  bad: number;
  dominant: string;
}

export interface CBReaction {
  hawkish: number;
  neutral: number;
  dovish: number;
  dominant: string;
}

export interface SentimentResult {
  riskOn: number;
  riskOff: number;
  neutral: number;
  macroSentiment: string;
  reversalRisk: boolean;
}

export interface AssetBias {
  bias: string;
  strength: string;
}

export interface MacroAnalysis {
  currencyId: number;
  currencyCode: string;
  growth: CategoryScore;
  inflation: CategoryScore;
  labor: CategoryScore;
  regime: string;
  adaptiveWeights: { growth: number; inflation: number; labor: number };
  totalMacroScore: number;
  macroScoreSigma: number;
  confidence: string;
  signalQuality: string;
  positionSizeMultiplier: number;
  fuzzy: FuzzyResult;
  cbReaction: CBReaction;
  sentiment: SentimentResult;
  usdBias: AssetBias;
  goldBias: AssetBias;
  indicesBias: AssetBias;
  finalRiskPercent: number;
}

export interface MarketPositioning {
  id: number;
  cotSpxNetSpec: number;
  cotUsdNetSpec: number;
  vixLevel: number;
  retailSentiment: string;
}

export interface Currency {
  id: number;
  code: string;
  name: string;
}

export interface PairSignal {
  pair: string;
  baseCurrency: string;
  quoteCurrency: string;
  signal: string; // "BUY", "SELL", "NEUTRAL"
  strength: string; // "Strong", "Medium", "Weak"
  macroDiff: number;
  baseScore: number;
  quoteScore: number;
  baseCB: string;
  quoteCB: string;
}

export interface SignalSnapshot {
  id: number;
  snapshotDate: string;
  pair: string;
  signal: string;
  strength: string;
  macroDiff: number;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
  result: string;
}
