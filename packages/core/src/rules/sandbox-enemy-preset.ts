import { sandboxEnemyPresetDefs, type SandboxEnemyPresetDef } from "../data/sandbox-enemy-presets";
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

export function resolveChapterBossEnemyEquipmentIds(
  equipment: EquipmentInstance[],
  defenderRealm: string,
  baseBagCapacity: number,
): string[] {
  const wearIds = resolveMilestoneEquipmentIds(equipment, defenderRealm);
  return appendStrongestBagItems(equipment, defenderRealm, wearIds, baseBagCapacity);
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
): string[] {
  const bandOrder = buildBalanceBandOrderMap();
  const targetBand = mapRealmNameToBalanceBand(defenderRealm);
  const targetOrder = bandOrder.get(targetBand);
  if (targetOrder === undefined) return [...wearIds];

  const idSet = new Set(wearIds);
  const ids = [...wearIds];

  const addIfNew = (item: EquipmentInstance | undefined) => {
    if (!item || idSet.has(item.instanceId)) return;
    ids.push(item.instanceId);
    idSet.add(item.instanceId);
  };

  const eligible = equipment.filter((item) => isEligibleForDefender(item, targetOrder, bandOrder));

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
  const wearIds = resolveMilestoneEquipmentIds(equipment, def.defenderRealm);
  const enemyEquipmentIds = appendStrongestBagItems(
    equipment,
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
