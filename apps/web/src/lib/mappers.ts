import {
  migrateLegacyBalanceRealm,
  migrateLegacyItemQuality,
  migrateLegacyMaxRealm,
  normalizeEquipmentCategory,
  normalizeEquipmentSlot,
  normalizeStringList,
  type EquipmentInstance,
  type ManualInstance,
} from "@xianfanlu/core";

export type EquipmentRow = {
  externalId: string;
  baseId?: string | null;
  name: string;
  slot: string;
  category: string;
  quality: string;
  balanceRealm: string;
  dropTags?: unknown;
  forgeTags?: unknown;
  upgradeTier?: number | null;
  affixSlots?: number | null;
  affixTags?: unknown;
  enabled: boolean;
  combat: unknown;
  growth: unknown;
  note: string;
};

export type ManualRow = {
  externalId: string;
  name: string;
  type: string;
  rank: string;
  maxRealm: string;
  enabled: boolean;
  level: number;
  proficiency: string;
  combat: unknown;
  growth: unknown;
  note: string;
};

export function mapEquipment(row: EquipmentRow): EquipmentInstance {
  const slot = normalizeEquipmentSlot(row.slot);
  return {
    id: row.externalId,
    instanceId: row.externalId,
    baseId: row.baseId?.trim() || row.externalId,
    name: row.name,
    slot,
    category: normalizeEquipmentCategory(slot, row.category),
    quality: migrateLegacyItemQuality(row.quality),
    balanceRealm: migrateLegacyBalanceRealm(row.balanceRealm ?? ""),
    dropTags: normalizeStringList(row.dropTags),
    forgeTags: normalizeStringList(row.forgeTags),
    upgradeTier: row.upgradeTier ?? 0,
    affixSlots: row.affixSlots ?? 0,
    affixTags: normalizeStringList(row.affixTags),
    enabled: row.enabled,
    combat: (row.combat as EquipmentInstance["combat"]) ?? {},
    growth: (row.growth as EquipmentInstance["growth"]) ?? {},
    note: row.note,
  };
}

export function mapManual(row: ManualRow): ManualInstance {
  return {
    id: row.externalId,
    instanceId: row.externalId,
    name: row.name,
    type: row.type,
    rank: row.rank,
    maxRealm: migrateLegacyMaxRealm(row.maxRealm),
    enabled: row.enabled,
    level: 1,
    proficiency: row.proficiency,
    combat: (row.combat as ManualInstance["combat"]) ?? {},
    growth: (row.growth as ManualInstance["growth"]) ?? {},
    note: row.note,
  };
}
