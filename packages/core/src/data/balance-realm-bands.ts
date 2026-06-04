export const balanceRealmBands = [
  { id: "凡俗期", sortOrder: 0, label: "凡俗期" },
  { id: "江湖期", sortOrder: 1, label: "江湖期" },
  { id: "宗师期", sortOrder: 2, label: "宗师期" },
  { id: "先天期", sortOrder: 3, label: "先天期" },
  { id: "炼气期", sortOrder: 4, label: "炼气期" },
  { id: "筑基期", sortOrder: 5, label: "筑基期" },
  { id: "金丹期", sortOrder: 6, label: "金丹期" },
] as const;

export type BalanceRealmBandId = (typeof balanceRealmBands)[number]["id"];

const bandIds = balanceRealmBands.map((b) => b.id) as [BalanceRealmBandId, ...BalanceRealmBandId[]];

export const balanceRealmBandIdSchema = bandIds;

/** 细境界名 → 大期（用于主角境界、旧数据迁移） */
const realmNameToBand: Record<string, BalanceRealmBandId> = {
  普通凡人: "凡俗期",
  江湖三流: "江湖期",
  江湖二流: "江湖期",
  江湖一流: "江湖期",
  武道宗师: "宗师期",
  先天武者: "先天期",
  炼气初期: "炼气期",
  炼气中期: "炼气期",
  炼气后期: "炼气期",
  筑基初期: "筑基期",
  筑基中期: "筑基期",
  筑基后期: "筑基期",
  金丹初期: "金丹期",
  金丹中期: "金丹期",
  金丹后期: "金丹期",
};

/** 旧 balanceRealm 或细境界名 → 大期 */
const legacyBalanceRealmToBand: Record<string, BalanceRealmBandId> = {
  ...realmNameToBand,
  凡俗期: "凡俗期",
  江湖期: "江湖期",
  宗师期: "宗师期",
  先天期: "先天期",
  炼气期: "炼气期",
  筑基期: "筑基期",
  金丹期: "金丹期",
};

export function buildBalanceBandOrderMap() {
  return new Map(balanceRealmBands.map((b) => [b.id, b.sortOrder]));
}

export function mapRealmNameToBalanceBand(realmName: string): BalanceRealmBandId {
  const trimmed = realmName.trim();
  return legacyBalanceRealmToBand[trimmed] ?? "凡俗期";
}

export function migrateLegacyBalanceRealm(old: string): BalanceRealmBandId {
  const trimmed = old.trim();
  if (!trimmed) return "凡俗期";
  return legacyBalanceRealmToBand[trimmed] ?? "凡俗期";
}

export function isBalanceRealmBandId(value: string): value is BalanceRealmBandId {
  return (balanceRealmBands as readonly { id: string }[]).some((b) => b.id === value);
}
