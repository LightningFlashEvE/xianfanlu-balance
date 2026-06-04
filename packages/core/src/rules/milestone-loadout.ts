import {
  buildBalanceBandOrderMap,
  mapRealmNameToBalanceBand,
  migrateLegacyBalanceRealm,
  type BalanceRealmBandId,
} from "../data/balance-realm-bands";
import type { EquipmentInstance } from "../schemas/equipment";
import { getLoadoutLimit } from "./loadout";

export type RealmOrdered = { name: string; sortOrder: number };

export function buildRealmOrderMap(realms: RealmOrdered[]) {
  return new Map(realms.map((realm) => [realm.name, realm.sortOrder]));
}

function loadoutKey(item: EquipmentInstance) {
  const limit = getLoadoutLimit(item);
  return limit?.key ?? `slot:${item.slot}`;
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

  const bestByKey = new Map<string, EquipmentInstance>();
  for (const item of eligible) {
    const key = loadoutKey(item);
    const itemOrder = bandOrderForEquipment(item, bandOrder);
    const prev = bestByKey.get(key);
    const prevOrder = prev ? bandOrderForEquipment(prev, bandOrder) : -1;
    if (!prev || itemOrder > prevOrder) {
      bestByKey.set(key, item);
    }
  }

  return [...bestByKey.values()].map((item) => item.instanceId);
}

export function normalizeEquipmentBalanceRealm(item: EquipmentInstance): BalanceRealmBandId {
  return migrateLegacyBalanceRealm(item.balanceRealm ?? "");
}
