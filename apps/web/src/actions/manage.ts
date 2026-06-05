"use server";

import { revalidateBalancePages } from "@/lib/revalidate-paths";
import {
  balanceRealmBands,
  migrateLegacyBalanceRealm,
  migrateLegacyItemQuality,
  migrateLegacyMaxRealm,
  normalizeEffectMap,
  normalizeEquipmentCategory,
  normalizeEquipmentSlot,
  normalizeStringList,
  realmNames,
  type BalanceRealmBandId,
  type EquipmentSlot,
  type ItemQualityId,
  type RealmName,
} from "@xianfanlu/core";
import { prisma } from "@/lib/db";

function revalidateAll() {
  revalidateBalancePages();
}

export async function getManageData() {
  const [equipment, manuals] = await Promise.all([
    prisma.equipment.findMany({ orderBy: { externalId: "asc" } }),
    prisma.manual.findMany({ orderBy: { externalId: "asc" } }),
  ]);

  return {
    balanceRealmBands: balanceRealmBands.map((b) => ({ id: b.id, label: b.label })),
    realmNames: [...realmNames],
    equipment: equipment.map((row) => {
      const slot = normalizeEquipmentSlot(row.slot);
      return {
        id: row.id,
        externalId: row.externalId,
        baseId: row.baseId?.trim() || row.externalId,
        name: row.name,
        slot,
        category: normalizeEquipmentCategory(slot, row.category),
        quality: migrateLegacyItemQuality(row.quality),
        balanceRealm: migrateLegacyBalanceRealm(row.balanceRealm),
        dropTags: normalizeStringList(row.dropTags),
        forgeTags: normalizeStringList(row.forgeTags),
        upgradeTier: row.upgradeTier ?? 0,
        affixSlots: row.affixSlots ?? 0,
        affixTags: normalizeStringList(row.affixTags),
        note: row.note,
        combat: normalizeEffectMap(row.combat),
        growth: normalizeEffectMap(row.growth),
      };
    }),
    manuals: manuals.map((row) => ({
      id: row.id,
      externalId: row.externalId,
      name: row.name,
      type: row.type,
      rank: row.rank,
      maxRealm: migrateLegacyMaxRealm(row.maxRealm),
      proficiency: row.proficiency,
      note: row.note,
      combat: normalizeEffectMap(row.combat),
      growth: normalizeEffectMap(row.growth),
    })),
  };
}

export async function updateEquipment(
  id: number,
  data: {
    name?: string;
    slot?: EquipmentSlot;
    category?: string;
    quality?: ItemQualityId;
    balanceRealm?: BalanceRealmBandId;
    baseId?: string;
    dropTags?: string[];
    forgeTags?: string[];
    upgradeTier?: number;
    affixSlots?: number;
    affixTags?: string[];
    note?: string;
    combat?: Record<string, number>;
    growth?: Record<string, number>;
  },
) {
  const row = await prisma.equipment.findUnique({ where: { id } });
  if (!row) return;

  const slot = data.slot ? normalizeEquipmentSlot(data.slot) : normalizeEquipmentSlot(row.slot);
  const category = normalizeEquipmentCategory(
    slot,
    data.category ?? row.category,
  );

  await prisma.equipment.update({
    where: { id },
    data: {
      name: data.name,
      slot,
      category,
      quality: data.quality ? migrateLegacyItemQuality(data.quality) : undefined,
      balanceRealm: data.balanceRealm
        ? migrateLegacyBalanceRealm(data.balanceRealm)
        : undefined,
      baseId: data.baseId === undefined ? undefined : data.baseId.trim() || row.externalId,
      dropTags: data.dropTags ? normalizeStringList(data.dropTags) : undefined,
      forgeTags: data.forgeTags ? normalizeStringList(data.forgeTags) : undefined,
      upgradeTier: data.upgradeTier,
      affixSlots: data.affixSlots,
      affixTags: data.affixTags ? normalizeStringList(data.affixTags) : undefined,
      note: data.note,
      combat: data.combat ?? undefined,
      growth: data.growth ?? undefined,
    },
  });
  revalidateAll();
}

export async function addEquipment() {
  return addEquipmentWithDefaults();
}

export async function addEquipmentWithDefaults(data: {
  name?: string;
  slot?: EquipmentSlot;
  category?: string;
  quality?: ItemQualityId;
  balanceRealm?: BalanceRealmBandId;
} = {}) {
  const count = await prisma.equipment.count();
  const externalId = `EC${String(count + 1).padStart(3, "0")}`;
  const slot = normalizeEquipmentSlot(data.slot ?? "其他");
  const category = normalizeEquipmentCategory(slot, data.category ?? "其他");
  const quality = migrateLegacyItemQuality(data.quality ?? "凡品");
  const balanceRealm = migrateLegacyBalanceRealm(data.balanceRealm ?? "凡俗期");
  const name = data.name?.trim() || (category === "其他" ? "新装备" : `新${category}`);
  await prisma.equipment.create({
    data: {
      externalId,
      baseId: externalId,
      name,
      slot,
      category,
      quality,
      balanceRealm,
      dropTags: [],
      forgeTags: [],
      upgradeTier: 0,
      affixSlots: 0,
      affixTags: [],
      enabled: false,
      combat: { attackFlat: 1 },
      growth: {},
      note: "",
    },
  });
  revalidateAll();
}

export async function deleteEquipment(id: number) {
  const row = await prisma.equipment.findUnique({ where: { id } });
  if (!row) return;

  const config = await prisma.heroConfig.findUnique({ where: { id: 1 } });
  if (config) {
    const heroIds = (config.heroEquipmentIds as string[]).filter((x) => x !== row.externalId);
    const enemyIds = (config.enemyEquipmentIds as string[]).filter((x) => x !== row.externalId);
    await prisma.heroConfig.update({
      where: { id: 1 },
      data: { heroEquipmentIds: heroIds, enemyEquipmentIds: enemyIds },
    });
  }

  await prisma.equipment.delete({ where: { id } });
  revalidateAll();
}

export async function updateManual(
  id: number,
  data: {
    name?: string;
    type?: string;
    rank?: string;
    maxRealm?: RealmName;
    proficiency?: string;
    note?: string;
    combat?: Record<string, number>;
    growth?: Record<string, number>;
  },
) {
  await prisma.manual.update({
    where: { id },
    data: {
      name: data.name,
      type: data.type,
      rank: data.rank,
      maxRealm: data.maxRealm ? migrateLegacyMaxRealm(data.maxRealm) : undefined,
      proficiency: data.proficiency,
      note: data.note,
      combat: data.combat ?? undefined,
      growth: data.growth ?? undefined,
    },
  });
  revalidateAll();
}

export async function addManual() {
  const count = await prisma.manual.count();
  const externalId = `MC${String(count + 1).padStart(3, "0")}`;
  await prisma.manual.create({
    data: {
      externalId,
      name: "新功法",
      type: "功法",
      rank: "凡阶",
      maxRealm: "普通凡人",
      enabled: false,
      level: 1,
      proficiency: "初窥门径",
      combat: {},
      growth: { cultivationSpeedMultiplier: 1.05 },
      note: "",
    },
  });
  revalidateAll();
}

export async function deleteManual(id: number) {
  await prisma.manual.delete({ where: { id } });
  revalidateAll();
}
