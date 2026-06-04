"use server";

import { data, type HeroStats } from "@xianfanlu/core";
import { prisma } from "@/lib/db";
import { mapEquipment, mapManual } from "@/lib/mappers";
import { normalizeAptitude } from "@/lib/normalize-aptitude";

export async function loadBalanceState() {
  const [realms, equipmentRows, manualRows, heroConfig] = await Promise.all([
    prisma.realm.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.equipment.findMany({ orderBy: { externalId: "asc" } }),
    prisma.manual.findMany({ orderBy: { externalId: "asc" } }),
    prisma.heroConfig.findUnique({ where: { id: 1 } }),
  ]);

  const equipment = equipmentRows.map(mapEquipment);
  const manuals = manualRows.map(mapManual);
  const config = heroConfig ?? {
    heroRealm: "普通凡人",
    combatMultiplier: data.heroDefaults.combatMultiplier,
    baseBagCapacity: data.heroDefaults.baseBagCapacity,
    stats: data.heroDefaults.stats,
    aptitude: data.heroDefaults.aptitude,
    heroEquipmentIds: ["E001", "E002", "E003"],
    enemyEquipmentIds: [] as string[],
    attackerRealm: "普通凡人",
    defenderRealm: "江湖三流",
    enemyTemplateScale: 0.88,
  };

  return {
    realms: realms.map((r) => ({
      id: r.id,
      name: r.name,
      multiplier: r.multiplier,
      sortOrder: r.sortOrder,
    })),
    equipment,
    manuals,
    stats: config.stats as HeroStats,
    aptitude: normalizeAptitude(config.aptitude),
    heroRealm: config.heroRealm,
    combatMultiplier: config.combatMultiplier,
    heroEquipmentIds: (config.heroEquipmentIds as string[]) ?? [],
    enemyEquipmentIds: (config.enemyEquipmentIds as string[]) ?? [],
    attackerRealm: config.attackerRealm,
    defenderRealm: config.defenderRealm,
    enemyTemplateScale: config.enemyTemplateScale,
    baseBagCapacity: config.baseBagCapacity,
  };
}
