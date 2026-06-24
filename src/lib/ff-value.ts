/**
 * Parse Forex Factory-style string values into raw numbers.
 * Examples: "0.4%" -> 0.4, "25.5K" -> 25500, "-5.1M" -> -5100000, "-191B" -> -191000000000
 */
export function parseFFValue(value: string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const clean = String(value)
    .replace(/,/g, "") // remove thousands separators
    .replace(/\s+/g, "")
    .trim();
  if (clean === "" || clean === "-") return 0;

  const sign = clean.startsWith("-") ? -1 : 1;
  const unsigned = clean.replace(/^-/, "");

  const multiplier = unsigned.endsWith("%")
    ? 1
    : unsigned.endsWith("B")
    ? 1_000_000_000
    : unsigned.endsWith("M")
    ? 1_000_000
    : unsigned.endsWith("K")
    ? 1_000
    : 1;

  const numeric = unsigned.replace(/[%BKM]$/i, "");
  const parsed = parseFloat(numeric);

  if (isNaN(parsed)) return 0;
  return sign * parsed * multiplier;
}
