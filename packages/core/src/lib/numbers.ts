export function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toPositiveNumber(value: unknown, fallback: number): number {
  return Math.max(toNumber(value, fallback), 0.0001);
}

export function clampNumber(value: number, min = -Infinity, max = Infinity): number {
  return Math.min(Math.max(value, min), max);
}

export function formatNumber(value: number, digits: number): string {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

export function signedPercent(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNumber(value, 0)}%`;
}
