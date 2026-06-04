export const fiveElements = ["金", "木", "水", "火", "土"] as const;
export type FiveElement = (typeof fiveElements)[number];

export const spiritualRootCountOptions = [1, 2, 3, 4, 5] as const;

const countGradeLabels: Record<number, string> = {
  1: "单灵根",
  2: "双灵根",
  3: "三灵根",
  4: "四灵根（伪）",
  5: "五灵根（伪）",
};

/** 韩立向默认：四灵根，木火土水，缺金 */
export const defaultSpiritualRootElements: FiveElement[] = ["木", "火", "土", "水"];

export function formatSpiritualRootLabel(elements: readonly string[]): string {
  const count = elements.length;
  if (count < 1 || count > 5) return "未测定灵根";
  const grade = countGradeLabels[count] ?? `${count}灵根`;
  const sorted = [...elements].sort(
    (a, b) => fiveElements.indexOf(a as FiveElement) - fiveElements.indexOf(b as FiveElement),
  );
  return `${grade} · ${sorted.join("")}`;
}

export function getSpiritualRootCountMultiplier(
  count: number,
  multipliers: Record<string, number>,
): number {
  const key = String(count);
  return multipliers[key] ?? multipliers["5"] ?? 0.6;
}

/** 将旧版字符串灵根或残缺数据规范为五行品相 */
export function normalizeSpiritualRootElements(
  aptitude: { spiritualRoot?: string; spiritualRootElements?: string[] },
): FiveElement[] {
  const raw = aptitude.spiritualRootElements;
  if (Array.isArray(raw) && raw.length >= 1 && raw.length <= 5) {
    const valid = raw.filter((e): e is FiveElement =>
      (fiveElements as readonly string[]).includes(e),
    );
    if (valid.length === raw.length) return valid;
  }
  return [...defaultSpiritualRootElements];
}

export function buildAptitudeSpiritualRoot(
  elements: FiveElement[],
): { spiritualRootElements: FiveElement[]; spiritualRoot: string } {
  const spiritualRootElements = [...elements];
  return {
    spiritualRootElements,
    spiritualRoot: formatSpiritualRootLabel(spiritualRootElements),
  };
}
