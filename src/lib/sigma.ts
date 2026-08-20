/**
 * Statistically-founded sigma estimation for macro surprises.
 *
 * The macro engine scores each indicator as a z-score (actual - forecast) / sigma.
 * Historically `sigma` was a crude `|forecast - previous| / 2` proxy (see
 * `approxSigma` in macro.ts), which made z-scores incomparable across indicators.
 *
 * This module derives sigma from the indicator's own history:
 *  1. preferred — standard deviation of past *surprises* (actual - forecast),
 *     which is exactly the quantity the z-score normalises;
 *  2. fallback — standard deviation of period-over-period *changes* of the
 *     published value, available whenever we have a series of actuals (e.g. FRED).
 *
 * When there is not enough history, returns null and the caller keeps the
 * legacy proxy as a last resort.
 */

export interface SigmaEstimate {
  sigma: number;
  /** How sigma was derived — useful for UI/debugging. */
  method: "surprise" | "change";
  /** Number of samples that fed the estimate. */
  samples: number;
}

export interface EstimateSigmaInput {
  /** Past (actual - forecast) surprises, any order. */
  surprises?: number[];
  /** Series of published actual values, any order — used for change volatility. */
  values?: number[];
  /** Minimum samples required before an estimate is trusted (default 5). */
  minSamples?: number;
  /** Lower bound applied to the result to avoid divide-by-near-zero (default 1e-9). */
  floor?: number;
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

/** Sample standard deviation (n-1). Returns 0 for fewer than 2 points. */
export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((sum, x) => sum + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** Std-dev of the surprise distribution (actual - forecast). */
export function surpriseVolatility(surprises: number[]): number {
  return stddev(surprises.filter((s) => Number.isFinite(s)));
}

/**
 * Std-dev of first differences of a value series (period-over-period changes).
 * `values` may be in any order; they are not assumed sorted because the typical
 * caller passes chronologically-ordered rows already.
 */
export function changeVolatility(values: number[]): number {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2) return 0;
  const changes: number[] = [];
  for (let i = 1; i < clean.length; i++) {
    changes.push(clean[i] - clean[i - 1]);
  }
  return stddev(changes);
}

/**
 * Estimate a robust sigma from available history. Prefers surprise volatility,
 * falls back to change volatility, and returns null when neither has enough
 * data or both collapse to zero.
 */
export function estimateSigma(input: EstimateSigmaInput): SigmaEstimate | null {
  const minSamples = input.minSamples ?? 5;
  const floor = input.floor ?? 1e-9;

  const surprises = (input.surprises ?? []).filter((s) => Number.isFinite(s));
  if (surprises.length >= minSamples) {
    const sigma = surpriseVolatility(surprises);
    if (sigma > floor) {
      return { sigma, method: "surprise", samples: surprises.length };
    }
  }

  const values = (input.values ?? []).filter((v) => Number.isFinite(v));
  if (values.length >= minSamples) {
    const sigma = changeVolatility(values);
    if (sigma > floor) {
      // change volatility overstates surprise dispersion: a forecast already
      // anticipates most of the move. Scale down to approximate the residual.
      return { sigma: sigma * 0.5, method: "change", samples: values.length };
    }
  }

  return null;
}
