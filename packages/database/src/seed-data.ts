import {
  data,
  migrateLegacyBalanceRealm,
  migrateLegacyItemQuality,
  migrateLegacyMaxRealm,
  normalizeEquipmentCategory,
  normalizeEquipmentSlot,
} from "@xianfanlu/core";
import type { PrismaClient } from "@prisma/client";

export async function seedDatabase(prisma: PrismaClient) {
  await prisma.realm.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.manual.deleteMany();

  await prisma.realm.createMany({
    data: data.realmsInitial.map((realm, index) => ({
      name: realm.name,
      multiplier: realm.multiplier,
      sortOrder: index,
    })),
  });

  await prisma.equipment.createMany({
    data: data.equipmentLibrary.map((item, index) => ({
      externalId: item.id,
      name: item.name,
      slot: normalizeEquipmentSlot(item.slot),
      category: normalizeEquipmentCategory(item.slot, item.category),
      quality: migrateLegacyItemQuality(item.quality),
      balanceRealm: migrateLegacyBalanceRealm(item.balanceRealm ?? ""),
      combat: item.combat ?? {},
      growth: item.growth ?? {},
      note: item.note ?? "",
      enabled: index < 3,
    })),
  });

  await prisma.manual.createMany({
    data: data.manualsLibrary.map((item) => ({
      externalId: item.id,
      name: item.name,
      type: item.type,
      rank: item.rank,
      quality: migrateLegacyItemQuality(item.quality),
      maxRealm: migrateLegacyMaxRealm(item.maxRealm),
      combat: item.combat ?? {},
      growth: item.growth ?? {},
      note: item.note ?? "",
      enabled: item.id === "M001" || item.id === "M002" || item.id === "M000",
      level: 1,
      proficiency:
        item.id === "M001"
          ? "炉火纯青"
          : item.id === "M000"
            ? "略有小成"
            : "略有小成",
    })),
  });

  await prisma.heroConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      heroRealm: "普通凡人",
      combatMultiplier: data.heroDefaults.combatMultiplier,
      baseBagCapacity: data.heroDefaults.baseBagCapacity,
      stats: data.heroDefaults.stats,
      aptitude: data.heroDefaults.aptitude,
      heroEquipmentIds: ["E001", "E002", "E003"],
      enemyEquipmentIds: [],
      attackerRealm: "普通凡人",
      defenderRealm: "江湖三流",
      enemyTemplateScale: 0.88,
    },
    update: {
      heroRealm: "普通凡人",
      combatMultiplier: data.heroDefaults.combatMultiplier,
      baseBagCapacity: data.heroDefaults.baseBagCapacity,
      stats: data.heroDefaults.stats,
      aptitude: data.heroDefaults.aptitude,
      heroEquipmentIds: ["E001", "E002", "E003"],
      enemyEquipmentIds: [],
      attackerRealm: "普通凡人",
      defenderRealm: "江湖三流",
      enemyTemplateScale: 0.88,
    },
  });
}
