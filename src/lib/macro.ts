import {
  IndicatorInput,
  CategoryScore,
  MacroAnalysis,
  FuzzyResult,
  CBReaction,
  SentimentResult,
  AssetBias,
  MarketPositioning,
  PairSignal,
} from "./types";

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function approxSigma(forecast: number, previous: number): number {
  const diff = Math.abs(forecast - previous) / 2;
  if (diff > 0) return diff;
  // Fallback: use a fraction of the forecast magnitude
  return Math.abs(forecast) * 0.1 || 1;
}

export function computeCategoryScore(indicators: IndicatorInput[]): CategoryScore {
  const results = indicators.map((ind) => {
    const sigma = ind.sigma && ind.sigma > 0 ? ind.sigma : approxSigma(ind.forecast, ind.previous);

    // If actual is 0 and forecast is non-zero, the event is likely not yet released.
    // Use (forecast - previous) as a proxy for expected direction (anticipation score).
    const isUnreleased = ind.actual === 0 && ind.forecast !== 0;
    const effectiveActual = isUnreleased ? ind.forecast : ind.actual;
    const rawScore = (effectiveActual - ind.forecast) / sigma;
    const clampedScore = clamp(rawScore, -2, 2);
    const finalScore = ind.sign * clampedScore;
    const weightedScore = finalScore * ind.weight;
    return {
      name: ind.name,
      previous: ind.previous,
      forecast: ind.forecast,
      actual: ind.actual,
      sigma,
      rawScore,
      clampedScore,
      finalScore,
      weightedScore,
      weight: ind.weight,
    };
  });

  const score = results.reduce((sum, r) => sum + r.weightedScore, 0);
  const variance = results.reduce((sum, r) => sum + Math.pow(r.weight * r.rawScore, 2), 0);

  return { score, variance, indicators: results };
}

function detectRegime(growthScore: number, inflationScore: number): string {
  const g = growthScore > 0.5 ? "Strong" : growthScore < -0.5 ? "Weak" : "Neutral";
  const i = inflationScore > 0.5 ? "High" : inflationScore < -0.5 ? "Low" : "Neutral";
  return `${g} / ${i}`;
}

function getAdaptiveWeights(growthScore: number, inflationScore: number) {
  const g = growthScore > 0.5 ? "S" : growthScore < -0.5 ? "W" : "N";
  const i = inflationScore > 0.5 ? "H" : inflationScore < -0.5 ? "L" : "N";

  if (g === "S" && i === "H") return { growth: 0.35, inflation: 0.45, labor: 0.20, regime: "Overheating" };
  if (g === "S" && i === "N") return { growth: 0.50, inflation: 0.30, labor: 0.20, regime: "Expansion" };
  if (g === "S" && i === "L") return { growth: 0.45, inflation: 0.25, labor: 0.30, regime: "Disinflationary Growth" };
  if (g === "N" && i === "H") return { growth: 0.40, inflation: 0.40, labor: 0.20, regime: "Normal (Inflation High)" };
  if (g === "N" && i === "N") return { growth: 0.40, inflation: 0.40, labor: 0.20, regime: "Normal" };
  if (g === "N" && i === "L") return { growth: 0.40, inflation: 0.40, labor: 0.20, regime: "Normal (Inflation Low)" };
  if (g === "W" && i === "H") return { growth: 0.30, inflation: 0.50, labor: 0.20, regime: "Stagflation" };
  if (g === "W" && i === "N") return { growth: 0.30, inflation: 0.20, labor: 0.50, regime: "Recession" };
  if (g === "W" && i === "L") return { growth: 0.30, inflation: 0.20, labor: 0.50, regime: "Recession (Disinflation)" };
  return { growth: 0.40, inflation: 0.40, labor: 0.20, regime: "Normal" };
}

function getConfidence(totalMacroScore: number): string {
  const s = totalMacroScore;
  if (s >= 1.5) return "High Confidence";
  if (s >= 0.75) return "Medium-High";
  if (s >= 0.25) return "Medium";
  if (s >= -0.25) return "Low";
  if (s >= -0.75) return "Medium";
  if (s >= -1.5) return "Medium-High";
  return "High Confidence";
}

function getSignalQuality(growth: number, inflation: number, labor: number): { quality: string; multiplier: number } {
  const sg = Math.sign(growth) || 0;
  const si = Math.sign(inflation) || 0;
  const sl = Math.sign(labor) || 0;
  if (sg === si && si === sl && sg !== 0) {
    return { quality: "CLEAR", multiplier: 1.0 };
  }
  return { quality: "MIXED", multiplier: 0.5 };
}

function computeFuzzy(score: number): FuzzyResult {
  let good = 0;
  let bad = 0;
  let avg = 0;

  if (score <= 0.2) good = 0;
  else if (score < 0.8) good = (score - 0.2) / 0.6;
  else good = 1;

  if (score <= -0.8) bad = 1;
  else if (score < -0.2) bad = (-0.2 - score) / 0.6;
  else bad = 0;

  if (Math.abs(score) <= 0.5) avg = 1 - Math.abs(score) / 0.5;
  else avg = 0;

  const maxVal = Math.max(good, avg, bad);
  let dominant = "AVG";
  if (maxVal === good) dominant = "GOOD";
  if (maxVal === bad) dominant = "BAD";

  return { good, avg, bad, dominant };
}

function getBaseCBProbabilities(growthState: string, inflationState: string): { hawkish: number; neutral: number; dovish: number } {
  const g = growthState;
  const i = inflationState;
  if (g === "Strong" && i === "High") return { hawkish: 0.85, neutral: 0.10, dovish: 0.05 };
  if (g === "Strong" && i === "Neutral") return { hawkish: 0.40, neutral: 0.45, dovish: 0.15 };
  if (g === "Strong" && i === "Low") return { hawkish: 0.15, neutral: 0.50, dovish: 0.35 };
  if (g === "Neutral" && i === "High") return { hawkish: 0.60, neutral: 0.30, dovish: 0.10 };
  if (g === "Neutral" && i === "Neutral") return { hawkish: 0.25, neutral: 0.50, dovish: 0.25 };
  if (g === "Neutral" && i === "Low") return { hawkish: 0.10, neutral: 0.35, dovish: 0.55 };
  if (g === "Weak" && i === "High") return { hawkish: 0.60, neutral: 0.30, dovish: 0.10 };
  if (g === "Weak" && i === "Neutral") return { hawkish: 0.20, neutral: 0.40, dovish: 0.40 };
  if (g === "Weak" && i === "Low") return { hawkish: 0.05, neutral: 0.20, dovish: 0.75 };
  return { hawkish: 0.25, neutral: 0.50, dovish: 0.25 };
}

function computeCBReaction(totalMacroScore: number, growthScore: number, inflationScore: number): CBReaction {
  const growthState = growthScore > 0.5 ? "Strong" : growthScore < -0.5 ? "Weak" : "Neutral";
  const inflationState = inflationScore > 0.5 ? "High" : inflationScore < -0.5 ? "Low" : "Neutral";
  let { hawkish, neutral, dovish } = getBaseCBProbabilities(growthState, inflationState);

  if (totalMacroScore > 0.5) {
    hawkish += 0.05;
    dovish -= 0.05;
  } else if (totalMacroScore < -0.5) {
    dovish += 0.05;
    hawkish -= 0.05;
  }

  const total = hawkish + neutral + dovish;
  hawkish = Math.max(0, hawkish / total);
  neutral = Math.max(0, neutral / total);
  dovish = Math.max(0, dovish / total);

  const maxVal = Math.max(hawkish, neutral, dovish);
  let dominant = "Neutral";
  if (maxVal === hawkish) dominant = "Hawkish";
  if (maxVal === dovish) dominant = "Dovish";

  return { hawkish, neutral, dovish, dominant };
}

function computeMacroDrivenSentiment(fuzzyDominant: string, cbDominant: string): number {
  const key = `${fuzzyDominant}-${cbDominant}`;
  const map: Record<string, number> = {
    "GOOD-Hawkish": 0.0,
    "GOOD-Neutral": 0.6,
    "GOOD-Dovish": 1.0,
    "AVG-Hawkish": -0.3,
    "AVG-Neutral": 0.0,
    "AVG-Dovish": 0.3,
    "BAD-Hawkish": -1.0,
    "BAD-Neutral": -0.6,
    "BAD-Dovish": 0.4,
  };
  return map[key] ?? 0;
}

function computeMarketPositioningScore(mp: MarketPositioning): number {
  const spx = mp.cotSpxNetSpec > 0 ? 1 : mp.cotSpxNetSpec < 0 ? -1 : 0;
  const usd = mp.cotUsdNetSpec < 0 ? 1 : mp.cotUsdNetSpec > 0 ? -1 : 0;
  const vix = mp.vixLevel < 20 ? 1 : mp.vixLevel > 30 ? -1 : 0;
  const retail =
    mp.retailSentiment === "extreme_bearish"
      ? 1
      : mp.retailSentiment === "extreme_bullish"
      ? -1
      : 0;
  return clamp((spx + usd + vix + retail) / 4, -1, 1);
}

function computeSentiment(
  fuzzyDominant: string,
  cbDominant: string,
  mp: MarketPositioning
): SentimentResult {
  const macroSentimentScore = computeMacroDrivenSentiment(fuzzyDominant, cbDominant);
  const marketPositioningScore = computeMarketPositioningScore(mp);
  const finalScore = 0.6 * macroSentimentScore + 0.4 * marketPositioningScore;

  let riskOn = 0;
  let riskOff = 0;
  let neutral = 0;

  if (finalScore > 0.2) {
    riskOn = clamp((finalScore + 0.2) / 1.2, 0, 1);
    riskOff = 0;
    neutral = 1 - riskOn;
  } else if (finalScore < -0.2) {
    riskOff = clamp((-finalScore + 0.2) / 1.2, 0, 1);
    riskOn = 0;
    neutral = 1 - riskOff;
  } else {
    neutral = 1 - 2.5 * Math.abs(finalScore);
    const rem = 1 - neutral;
    riskOn = rem * 0.5;
    riskOff = rem * 0.5;
  }

  const reversalRisk =
    (macroSentimentScore > 0.3 && marketPositioningScore < -0.5) ||
    (macroSentimentScore < -0.3 && marketPositioningScore > 0.5);

  let macroSentiment = "Neutral";
  if (macroSentimentScore >= 0.8) macroSentiment = "Strong Risk-On";
  else if (macroSentimentScore >= 0.4) macroSentiment = "Risk-On";
  else if (macroSentimentScore > 0) macroSentiment = "Slight Risk-On";
  else if (macroSentimentScore <= -0.8) macroSentiment = "Strong Risk-Off";
  else if (macroSentimentScore <= -0.4) macroSentiment = "Risk-Off";
  else if (macroSentimentScore < 0) macroSentiment = "Slight Risk-Off";

  return { riskOn, riskOff, neutral, macroSentiment, reversalRisk };
}

function computeUSDBias(cb: CBReaction, macroScore: number): AssetBias {
  if (cb.hawkish > 0.6 && macroScore > 0) return { bias: "Bullish USD", strength: "Strong" };
  if (cb.dovish > 0.6 && macroScore < 0) return { bias: "Bearish USD", strength: "Strong" };
  if (cb.neutral > 0.5) return { bias: "Neutral USD", strength: "Low conviction" };
  return { bias: "Mixed / No trade", strength: "Low" };
}

function computeGoldBias(cb: CBReaction, sentiment: SentimentResult, usdBias: AssetBias): AssetBias {
  if (sentiment.riskOff > 0.6) return { bias: "Bullish Gold", strength: "Strong" };
  if (cb.hawkish > 0.6 && usdBias.bias.includes("Bullish USD")) return { bias: "Bearish Gold", strength: "Medium" };
  if (cb.dovish + sentiment.riskOn > 0.6) return { bias: "Bearish Gold", strength: "Medium" };
  return { bias: "Neutral Gold", strength: "Low" };
}

function computeIndicesBias(sentiment: SentimentResult): AssetBias {
  if (sentiment.riskOn > 0.6 && !sentiment.reversalRisk) return { bias: "Bullish Indices", strength: "Strong" };
  if (sentiment.riskOff > 0.6) return { bias: "Bearish Indices", strength: "Strong" };
  if (sentiment.macroSentiment === "Relief Rally Possible" && sentiment.reversalRisk)
    return { bias: "Bullish Indices (counter-trend)", strength: "High risk" };
  return { bias: "Neutral Indices", strength: "Low" };
}

function computeFinalRisk(confidence: string, signalQuality: string, reversalRisk: boolean): number {
  const base = 1.0;
  const convMap: Record<string, number> = {
    "High Confidence": 1.0,
    "Medium-High": 0.7,
    Medium: 0.5,
    Low: 0.25,
  };
  const conv = convMap[confidence] ?? 0.25;
  const mixedMult = signalQuality === "MIXED" ? 0.5 : 1.0;
  const revMult = reversalRisk ? 0.7 : 1.0;
  return base * conv * mixedMult * revMult;
}

export function analyzeCurrency(
  currencyId: number,
  currencyCode: string,
  indicators: IndicatorInput[],
  mp: MarketPositioning
): MacroAnalysis {
  const growthInds = indicators.filter((i) => i.category === "Growth");
  const inflationInds = indicators.filter((i) => i.category === "Inflation");
  const laborInds = indicators.filter((i) => i.category === "Labor");

  const growth = computeCategoryScore(growthInds);
  const inflation = computeCategoryScore(inflationInds);
  const labor = computeCategoryScore(laborInds);

  const { growth: wG, inflation: wI, labor: wL, regime } = getAdaptiveWeights(growth.score, inflation.score);

  const totalMacroScore = growth.score * wG + inflation.score * wI + labor.score * wL;
  const macroScoreVariance =
    Math.pow(wG, 2) * growth.variance + Math.pow(wI, 2) * inflation.variance + Math.pow(wL, 2) * labor.variance;
  const macroScoreSigma = Math.sqrt(macroScoreVariance);

  const confidence = getConfidence(totalMacroScore);
  const { quality: signalQuality, multiplier: mixedMult } = getSignalQuality(growth.score, inflation.score, labor.score);

  const fuzzy = computeFuzzy(totalMacroScore);
  const cbReaction = computeCBReaction(totalMacroScore, growth.score, inflation.score);
  const sentiment = computeSentiment(fuzzy.dominant, cbReaction.dominant, mp);

  const usdBias = computeUSDBias(cbReaction, totalMacroScore);
  const goldBias = computeGoldBias(cbReaction, sentiment, usdBias);
  const indicesBias = computeIndicesBias(sentiment);

  const finalRiskPercent = computeFinalRisk(confidence, signalQuality, sentiment.reversalRisk);

  return {
    currencyId,
    currencyCode,
    growth,
    inflation,
    labor,
    regime,
    adaptiveWeights: { growth: wG, inflation: wI, labor: wL },
    totalMacroScore,
    macroScoreSigma,
    confidence,
    signalQuality,
    positionSizeMultiplier: mixedMult,
    fuzzy,
    cbReaction,
    sentiment,
    usdBias,
    goldBias,
    indicesBias,
    finalRiskPercent,
  };
}

export function generatePairSignals(analyses: MacroAnalysis[]): PairSignal[] {
  const pairs: PairSignal[] = [];
  // Only generate unique pairs: i < j (EUR/USD but not USD/EUR)
  for (let i = 0; i < analyses.length; i++) {
    for (let j = i + 1; j < analyses.length; j++) {
      const a = analyses[i];
      const b = analyses[j];
      const diff = a.totalMacroScore - b.totalMacroScore;

      // Determine which currency is stronger → that's the base for BUY direction
      const base = diff >= 0 ? a : b;
      const quote = diff >= 0 ? b : a;
      const absDiff = Math.abs(diff);

      let signal = "NEUTRAL";
      let strength = "Weak";

      if (absDiff > 0.5) {
        signal = "BUY";
        strength = "Strong";
      } else if (absDiff > 0.2) {
        signal = "BUY";
        strength = "Medium";
      }

      // CB stance overlay: if base is Hawkish and quote is Dovish, strengthen the BUY
      if (
        base.cbReaction.dominant === "Hawkish" &&
        quote.cbReaction.dominant === "Dovish" &&
        signal === "BUY"
      ) {
        strength = "Strong";
      }
      // If base is Dovish and quote is Hawkish, this weakens or flips the signal
      if (
        base.cbReaction.dominant === "Dovish" &&
        quote.cbReaction.dominant === "Hawkish"
      ) {
        if (absDiff < 0.5) {
          signal = "SELL";
          strength = absDiff > 0.2 ? "Medium" : "Weak";
        }
      }

      pairs.push({
        pair: `${base.currencyCode}/${quote.currencyCode}`,
        baseCurrency: base.currencyCode,
        quoteCurrency: quote.currencyCode,
        signal,
        strength,
        macroDiff: diff,
        baseScore: base.totalMacroScore,
        quoteScore: quote.totalMacroScore,
        baseCB: base.cbReaction.dominant,
        quoteCB: quote.cbReaction.dominant,
      });
    }
  }

  // Add XAU/USD and BTC/USD based on USD analysis sentiment
  const usdAnalysis = analyses.find((a) => a.currencyCode === "USD");
  if (usdAnalysis) {
    const gb = usdAnalysis.goldBias;
    const xauSignal = gb.bias === "Bullish Gold" ? "BUY" : gb.bias === "Bearish Gold" ? "SELL" : "NEUTRAL";
    pairs.push({
      pair: "XAU/USD",
      baseCurrency: "XAU",
      quoteCurrency: "USD",
      signal: xauSignal,
      strength: gb.strength === "Low" ? "Weak" : gb.strength,
      macroDiff: 0,
      baseScore: 0,
      quoteScore: usdAnalysis.totalMacroScore,
      baseCB: "-",
      quoteCB: usdAnalysis.cbReaction.dominant,
    });

    const s = usdAnalysis.sentiment;
    let btcSignal = "NEUTRAL";
    let btcStrength = "Weak";
    if (s.riskOn > 0.6) {
      btcSignal = "BUY";
      btcStrength = s.riskOn > 0.75 ? "Strong" : "Medium";
    } else if (s.riskOff > 0.6) {
      btcSignal = "SELL";
      btcStrength = s.riskOff > 0.75 ? "Strong" : "Medium";
    }
    pairs.push({
      pair: "BTC/USD",
      baseCurrency: "BTC",
      quoteCurrency: "USD",
      signal: btcSignal,
      strength: btcStrength,
      macroDiff: 0,
      baseScore: 0,
      quoteScore: usdAnalysis.totalMacroScore,
      baseCB: "-",
      quoteCB: usdAnalysis.cbReaction.dominant,
    });
  }

  // Sort by absolute macroDiff descending
  pairs.sort((a, b) => Math.abs(b.macroDiff) - Math.abs(a.macroDiff));
  return pairs;
}
