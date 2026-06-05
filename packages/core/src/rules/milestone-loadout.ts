import {
  buildBalanceBandOrderMap,
  mapRealmNameToBalanceBand,
  migrateLegacyBalanceRealm,
  type BalanceRealmBandId,
} from "../data/balance-realm-bands";
import { data } from "../data";
import type { EquipmentInstance } from "../schemas/equipment";
import type { ManualInstance } from "../schemas/manual";
import { getLoadoutLimit } from "./loadout";

export type RealmOrdered = { name: string; sortOrder: number };

const defaultMilestoneManualCapByBand: Record<BalanceRealmBandId, number> = {
  "凡俗期": 1,
  "江湖期": 3,
  "宗师期": 4,
  "先天期": 4,
  "炼气期": 5,
  "筑基期": 5,
  "金丹期": 6,
};

const defaultMilestoneManualGroupCaps: Record<string, number> = {
  主修功法: 1,
  身法: 1,
  武技: 2,
  术法: 2,
  通用: 1,
};

const manualRankOrder = new Map(
  ["凡阶", "江湖", "江湖 / 先天", "宗师", "先天", "炼气", "筑基", "金丹", "元婴", "自定义"].map(
    (rank, index) => [rank, index],
  ),
);

type ManualBalanceConfig = {
  milestoneMaxManualsByBand?: Partial<Record<BalanceRealmBandId, number>>;
  milestoneManualGroupCaps?: Record<string, number>;
};

export function buildRealmOrderMap(realms: RealmOrdered[]) {
  return new Map(realms.map((realm) => [realm.name, realm.sortOrder]));
}

function manualBalanceConfig(): ManualBalanceConfig {
  return (data.meta.manualBalance ?? {}) as ManualBalanceConfig;
}

function positiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

export function getManualStackGroup(manual: Pick<ManualInstance, "type">): string {
  const type = manual.type.trim();
  if (type.includes("内功") || type.includes("功法")) return "主修功法";
  if (type.includes("轻功") || type.includes("身法") || type.includes("步")) return "身法";
  if (["剑法", "刀法", "枪法", "棍法", "拳法", "暗器"].some((x) => type.includes(x))) {
    return "武技";
  }
  if (type.includes("诀") || type.includes("术") || type.includes("法")) return "术法";
  return type || "通用";
}

export function getMilestoneManualCap(targetRealm: string): number {
  const band = mapRealmNameToBalanceBand(targetRealm);
  const configured = manualBalanceConfig().milestoneMaxManualsByBand?.[band];
  return positiveInt(configured, defaultMilestoneManualCapByBand[band] ?? 4);
}

function getMilestoneManualGroupCap(group: string): number {
  const configured = manualBalanceConfig().milestoneManualGroupCaps?.[group];
  return positiveInt(
    configured,
    defaultMilestoneManualGroupCaps[group] ?? defaultMilestoneManualGroupCaps.通用 ?? 1,
  );
}

function manualRankScore(rank: string): number {
  return manualRankOrder.get(rank) ?? 0;
}

function compareManualCandidate(
  a: { manual: ManualInstance; order: number; index: number; group: string },
  b: { manual: ManualInstance; order: number; index: number; group: string },
) {
  return (
    b.order - a.order ||
    manualRankScore(b.manual.rank) - manualRankScore(a.manual.rank) ||
    b.manual.level - a.manual.level ||
    a.index - b.index
  );
}

function manualGroupPriority(group: string): number {
  if (group === "主修功法") return 100;
  if (group === "身法") return 90;
  if (group === "武技") return 80;
  if (group === "术法") return 70;
  return 50;
}

export function resolveMilestoneManuals(
  manuals: ManualInstance[],
  targetRealm: string,
  realmOrder: Map<string, number>,
) {
  const targetOrder = realmOrder.get(targetRealm);
  if (targetOrder === undefined) return [];

  const eligible = manuals
    .map((manual, index) => {
      const order = realmOrder.get(manual.maxRealm);
      if (order === undefined || order > targetOrder) return null;
      return { manual, order, index, group: getManualStackGroup(manual) };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const byGroup = new Map<string, typeof eligible>();
  for (const entry of eligible) {
    const group = byGroup.get(entry.group) ?? [];
    group.push(entry);
    byGroup.set(entry.group, group);
  }

  const selectedByGroup = [...byGroup.entries()].flatMap(([group, entries]) =>
    [...entries].sort(compareManualCandidate).slice(0, getMilestoneManualGroupCap(group)),
  );

  const cap = getMilestoneManualCap(targetRealm);
  return selectedByGroup
    .sort((a, b) => {
      const priority = manualGroupPriority(b.group) - manualGroupPriority(a.group);
      return priority || compareManualCandidate(a, b);
    })
    .slice(0, cap)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.manual);
}

function loadoutKey(item: EquipmentInstance) {
  const limit = getLoadoutLimit(item);
  return limit?.key ?? `slot:${item.slot}`;
}

function loadoutMax(item: EquipmentInstance) {
  return getLoadoutLimit(item)?.max ?? 1;
}

function bandOrderForEquipment(item: EquipmentInstance, bandOrder: Map<string, number>) {
  const band = migrateLegacyBalanceRealm(item.balanceRealm ?? "");
  return bandOrder.get(band) ?? -1;
}

/** 累计标准养成：大期 <= 主角当前大期 的装备，同部位取最高大期 */
export function resolveMilestoneEquipmentIds(
  equipment: EquipmentInstance[],
  targetRealm: string,
  _realmOrder?: Map<string, number>,
) {
  const bandOrder = buildBalanceBandOrderMap();
  const targetBand = mapRealmNameToBalanceBand(targetRealm);
  const targetOrder = bandOrder.get(targetBand);
  if (targetOrder === undefined) return [];

  const eligible = equipment.filter((item) => {
    const order = bandOrderForEquipment(item, bandOrder);
    return order >= 0 && order <= targetOrder;
  });

  const byKey = new Map<
    string,
    { max: number; items: { item: EquipmentInstance; order: number; index: number }[] }
  >();

  eligible.forEach((item, index) => {
    const key = loadoutKey(item);
    const group = byKey.get(key) ?? { max: loadoutMax(item), items: [] };
    group.max = Math.max(group.max, loadoutMax(item));
    group.items.push({ item, order: bandOrderForEquipment(item, bandOrder), index });
    byKey.set(key, group);
  });

  const selected = new Set<string>();
  for (const group of byKey.values()) {
    const chosen = [...group.items]
      .sort((a, b) => b.order - a.order || a.index - b.index)
      .slice(0, group.max);
    for (const entry of chosen) {
      selected.add(entry.item.instanceId);
    }
  }

  return eligible
    .filter((item) => selected.has(item.instanceId))
    .map((item) => item.instanceId);
}

export function normalizeEquipmentBalanceRealm(item: EquipmentInstance): BalanceRealmBandId {
  return migrateLegacyBalanceRealm(item.balanceRealm ?? "");
}
