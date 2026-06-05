import {
  sandboxEnemyPresetDefs,
  type SandboxEnemyPresetDef,
} from "../data/sandbox-enemy-presets";
import {
  buildBalanceBandOrderMap,
  mapRealmNameToBalanceBand,
  migrateLegacyBalanceRealm,
} from "../data/balance-realm-bands";
import { calculateBagCapacity, getLoadoutLimit } from "./loadout";
import type { EquipmentInstance } from "../schemas/equipment";
import {
  resolveMilestoneEquipmentIds,
  type RealmOrdered,
} from "./milestone-loadout";

/**
 * 章节 BOSS 守方：同 band 内上抬一档；已是 band 顶则取下一 band 入门境。
 * 凡俗期仅「普通凡人」→「江湖三流」。
 */
export function resolveChapterBossDefenderRealm(
  heroRealm: string,
  realms: RealmOrdered[],
): string {
  const sorted = [...realms].sort((a, b) => a.sortOrder - b.sortOrder);
  if (sorted.length === 0) return heroRealm;

  const heroBand = mapRealmNameToBalanceBand(heroRealm);
  const bandRealms = sorted.filter((r) => mapRealmNameToBalanceBand(r.name) === heroBand);
  const heroInBandIdx = bandRealms.findIndex((r) => r.name === heroRealm);
  if (heroInBandIdx < 0) {
    return bandRealms[bandRealms.length - 1]?.name ?? heroRealm;
  }

  if (heroInBandIdx < bandRealms.length - 1) {
    return bandRealms[heroInBandIdx + 1]!.name;
  }

  const lastInBand = bandRealms[bandRealms.length - 1]!;
  const globalIdx = sorted.findIndex((r) => r.name === lastInBand.name);
  if (globalIdx >= 0 && globalIdx < sorted.length - 1) {
    return sorted[globalIdx + 1]!.name;
  }
  return lastInBand.name;
}

export function resolveBreakthroughGateDefenderRealm(
  heroRealm: string,
  realms: RealmOrdered[],
): string | null {
  const sorted = [...realms].sort((a, b) => a.sortOrder - b.sortOrder);
  const index = sorted.findIndex((r) => r.name === heroRealm);
  if (index < 0 || index >= sorted.length - 1) return null;
  return sorted[index + 1]!.name;
}

export function isEnemyEquipmentAllowedForRealm(
  item: Pick<EquipmentInstance, "slot" | "category">,
  defenderRealm: string,
): boolean {
  if (item.slot === "特殊物" && item.category === "机缘物") {
    return false;
  }
  const bandOrder = buildBalanceBandOrderMap();
  const defenderBand = mapRealmNameToBalanceBand(defenderRealm);
  const defenderOrder = bandOrder.get(defenderBand) ?? 99;
  const qiRefiningOrder = bandOrder.get("炼气期") ?? 4;
  if (defenderOrder < qiRefiningOrder && (item.slot === "符箓" || item.slot === "傀儡")) {
    return false;
  }
  return true;
}

export function filterEnemyEquipmentForRealm(
  equipment: EquipmentInstance[],
  defenderRealm: string,
): EquipmentInstance[] {
  return equipment.filter((item) => isEnemyEquipmentAllowedForRealm(item, defenderRealm));
}

export function filterEnemyEquipmentIdsForRealm(
  equipment: EquipmentInstance[],
  ids: string[],
  defenderRealm: string,
): string[] {
  const allowedIds = new Set(
    filterEnemyEquipmentForRealm(equipment, defenderRealm).map((item) => item.instanceId),
  );
  return ids.filter((id) => allowedIds.has(id));
}

export function resolveEnemyMilestoneEquipmentIds(
  equipment: EquipmentInstance[],
  defenderRealm: string,
  realmOrder?: Map<string, number>,
): string[] {
  return resolveMilestoneEquipmentIds(
    filterEnemyEquipmentForRealm(equipment, defenderRealm),
    defenderRealm,
    realmOrder,
  );
}

export function resolveBreakthroughGateEnemyEquipmentIds(
  equipment: EquipmentInstance[],
  defenderRealm: string,
  baseBagCapacity: number,
): string[] {
  // 守门 enemy 精简装备：排除零战力/非核心装备
  // - 机缘物：只服务玩家探索/养成，不进入敌方模板
  // - 炼气期以下敌人：不能携带符箓/傀儡
  // - 储物袋：只提供背包容量，战斗零收益
  // - 傀儡：对高境界 enemy 贡献微弱
  // - 防御符箓：守门 enemy 不需要多层防御消耗品
  // - 筑基期前不能装备法器
  const defenderBand = mapRealmNameToBalanceBand(defenderRealm);
  const bandOrder = buildBalanceBandOrderMap();
  const defenderOrder = bandOrder.get(defenderBand) ?? 99;
  const isPreFoundation = defenderOrder < bandOrder.get("筑基期")!;
  const gateEquipment = filterEnemyEquipmentForRealm(equipment, defenderRealm).filter((item) => {
    if (item.slot === "储物袋" || item.slot === "傀儡") return false;
    if (item.slot === "符箓" && item.category === "防御符") return false;
    if (isPreFoundation && item.slot === "法器") return false;
    return true;
  });
  return resolveMilestoneEquipmentIds(gateEquipment, defenderRealm);
}

export function resolveChapterBossEnemyEquipmentIds(
  equipment: EquipmentInstance[],
  defenderRealm: string,
  baseBagCapacity: number,
): string[] {
  // 章节 BOSS 同样精简；机缘物不进敌方模板，炼气期以下敌人不能携带符箓/傀儡。
  const defenderBand = mapRealmNameToBalanceBand(defenderRealm);
  const bandOrder = buildBalanceBandOrderMap();
  const defenderOrder = bandOrder.get(defenderBand) ?? 99;
  const isPreFoundation = defenderOrder < bandOrder.get("筑基期")!;
  const bossEquipment = filterEnemyEquipmentForRealm(equipment, defenderRealm).filter((item) => {
    if (item.slot === "储物袋" || item.slot === "傀儡") return false;
    if (item.slot === "符箓" && item.category === "防御符") return false;
    if (isPreFoundation && item.slot === "法器") return false;
    return true;
  });
  return resolveMilestoneEquipmentIds(bossEquipment, defenderRealm);
}

export type ResolvedSandboxEnemyPreset = {
  bandId: SandboxEnemyPresetDef["bandId"];
  label: string;
  defenderRealm: string;
  enemyTemplateScale: number;
  enemyEquipmentIds: string[];
  equipmentCount: number;
  summary: string;
};

function bandOrderForEquipment(
  item: EquipmentInstance,
  bandOrder: Map<string, number>,
): number {
  const band = migrateLegacyBalanceRealm(item.balanceRealm ?? "");
  return bandOrder.get(band) ?? -1;
}

function isEligibleForDefender(
  item: EquipmentInstance,
  targetOrder: number,
  bandOrder: Map<string, number>,
): boolean {
  const order = bandOrderForEquipment(item, bandOrder);
  return order >= 0 && order <= targetOrder;
}

/** 在守门养成装基础上，补充同阶段最强符箓/傀儡（受背包容量约束） */
export function appendStrongestBagItems(
  equipment: EquipmentInstance[],
  defenderRealm: string,
  wearIds: string[],
  baseBagCapacity: number,
  options?: { maxExtraItems?: number },
): string[] {
  const bandOrder = buildBalanceBandOrderMap();
  const targetBand = mapRealmNameToBalanceBand(defenderRealm);
  const targetOrder = bandOrder.get(targetBand);
  if (targetOrder === undefined) return [...wearIds];

  const idSet = new Set(wearIds);
  const ids = [...wearIds];
  let extraCount = 0;

  const addIfNew = (item: EquipmentInstance | undefined) => {
    if (!item || idSet.has(item.instanceId)) return;
    if (options?.maxExtraItems !== undefined && extraCount >= options.maxExtraItems) return;
    ids.push(item.instanceId);
    idSet.add(item.instanceId);
    extraCount += 1;
  };

  const eligible = filterEnemyEquipmentForRealm(equipment, defenderRealm).filter((item) =>
    isEligibleForDefender(item, targetOrder, bandOrder),
  );

  const talismanCategories = ["攻击符", "防御符", "辅助符"] as const;
  for (const category of talismanCategories) {
    const best = eligible
      .filter((item) => item.slot === "符箓" && item.category === category)
      .sort((a, b) => bandOrderForEquipment(b, bandOrder) - bandOrderForEquipment(a, bandOrder))[0];
    addIfNew(best);
  }

  const bestPuppet = eligible
    .filter((item) => item.slot === "傀儡")
    .sort((a, b) => bandOrderForEquipment(b, bandOrder) - bandOrderForEquipment(a, bandOrder))[0];
  addIfNew(bestPuppet);

  return trimEquipmentIdsToCapacity(equipment, ids, baseBagCapacity);
}

function trimEquipmentIdsToCapacity(
  equipment: EquipmentInstance[],
  ids: string[],
  baseBagCapacity: number,
): string[] {
  const items = ids
    .map((id) => equipment.find((item) => item.instanceId === id))
    .filter((item): item is EquipmentInstance => Boolean(item));
  const capacity = calculateBagCapacity(items, baseBagCapacity);
  if (items.length <= capacity) return ids;

  const wearIds: string[] = [];
  const bagItems: EquipmentInstance[] = [];
  for (const item of items) {
    if (getLoadoutLimit(item)) wearIds.push(item.instanceId);
    else bagItems.push(item);
  }

  const bandOrder = buildBalanceBandOrderMap();
  bagItems.sort(
    (a, b) => bandOrderForEquipment(b, bandOrder) - bandOrderForEquipment(a, bandOrder),
  );

  const result = [...wearIds];
  for (const item of bagItems) {
    if (result.length >= capacity) break;
    result.push(item.instanceId);
  }
  return result;
}

export function resolveSandboxEnemyPreset(
  equipment: EquipmentInstance[],
  def: SandboxEnemyPresetDef,
  baseBagCapacity = 12,
): ResolvedSandboxEnemyPreset {
  // 沙盘模板 enemy 同样应用限制：炼气期以下不可携带符箓/傀儡，筑基期前不可装备法器。
  const defenderBand = mapRealmNameToBalanceBand(def.defenderRealm);
  const bandOrder = buildBalanceBandOrderMap();
  const defenderOrder = bandOrder.get(defenderBand) ?? 99;
  const isPreFoundation = defenderOrder < bandOrder.get("筑基期")!;
  const filtered = filterEnemyEquipmentForRealm(equipment, def.defenderRealm).filter((item) => {
    if (isPreFoundation && item.slot === "法器") return false;
    return true;
  });
  const wearIds = resolveMilestoneEquipmentIds(filtered, def.defenderRealm);
  const enemyEquipmentIds = appendStrongestBagItems(
    filtered,
    def.defenderRealm,
    wearIds,
    baseBagCapacity,
  );
  return {
    bandId: def.bandId,
    label: def.label,
    defenderRealm: def.defenderRealm,
    enemyTemplateScale: def.enemyTemplateScale,
    enemyEquipmentIds,
    equipmentCount: enemyEquipmentIds.length,
    summary: def.summary,
  };
}

export function resolveAllSandboxEnemyPresets(
  equipment: EquipmentInstance[],
  baseBagCapacity = 12,
): ResolvedSandboxEnemyPreset[] {
  return sandboxEnemyPresetDefs.map((def) =>
    resolveSandboxEnemyPreset(equipment, def, baseBagCapacity),
  );
}

export function findMatchingSandboxEnemyPreset(
  presets: ResolvedSandboxEnemyPreset[],
  config: {
    defenderRealm: string;
    enemyEquipmentIds: string[];
    enemyTemplateScale: number;
  },
): ResolvedSandboxEnemyPreset | undefined {
  const sortedIds = (ids: string[]) => [...ids].sort().join(",");
  const current = sortedIds(config.enemyEquipmentIds);
  return presets.find(
    (p) =>
      p.defenderRealm === config.defenderRealm &&
      p.enemyTemplateScale === config.enemyTemplateScale &&
      sortedIds(p.enemyEquipmentIds) === current,
  );
}
