export const itemQualityTiers = [
  { id: "凡品", sortOrder: 0, label: "凡品" },
  { id: "良品", sortOrder: 1, label: "良品" },
  { id: "珍品", sortOrder: 2, label: "珍品" },
  { id: "绝品", sortOrder: 3, label: "绝品" },
  { id: "未知", sortOrder: 4, label: "未知" },
] as const;

export type ItemQualityId = (typeof itemQualityTiers)[number]["id"];

const qualityIds = itemQualityTiers.map((q) => q.id) as [ItemQualityId, ...ItemQualityId[]];

export const itemQualityIdSchema = qualityIds;

const legacyQualityToId: Record<string, ItemQualityId> = {
  凡品: "凡品",
  良品: "良品",
  珍品: "珍品",
  绝品: "绝品",
  未知: "未知",
  破旧: "凡品",
  粗旧: "凡品",
  粗浅: "凡品",
  粗制: "凡品",
  入门: "凡品",
  精良: "良品",
  下品: "良品",
  中品: "良品",
  上乘: "珍品",
  上品: "珍品",
  炼气: "珍品",
  筑基: "珍品",
  机缘: "绝品",
  极品: "绝品",
  绝学残篇: "绝品",
  残缺古功: "绝品",
  传承: "绝品",
  自定义: "凡品",
};

export function migrateLegacyItemQuality(old: string): ItemQualityId {
  const trimmed = old.trim();
  if (!trimmed) return "未知";
  return legacyQualityToId[trimmed] ?? "未知";
}

export function isItemQualityId(value: string): value is ItemQualityId {
  return (itemQualityTiers as readonly { id: string }[]).some((q) => q.id === value);
}
