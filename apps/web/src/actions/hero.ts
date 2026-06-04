"use server";

import { revalidateBalancePages } from "@/lib/revalidate-paths";
import {
  aptitudeFields,
  buildAptitudeSpiritualRoot,
  fiveElements,
  formatNumber,
  spiritualRootCountOptions,
  statFields,
  type Aptitude,
  type FiveElement,
  type HeroStats,
} from "@xianfanlu/core";
import { seedDatabase } from "@xianfanlu/database/seed";
import { prisma } from "@/lib/db";
import { loadBalanceState } from "./state";
import { getMilestoneEvaluation } from "@/lib/milestone-eval";
import { normalizeAptitude } from "@/lib/normalize-aptitude";

function revalidateEvaluator() {
  revalidateBalancePages();
}

export async function getHeroEditorData() {
  const state = await loadBalanceState();
  const { context } = getMilestoneEvaluation(state);
  const progression = context.progression;

  return {
    stats: state.stats,
    aptitude: state.aptitude,
    heroRealm: state.heroRealm,
    combatMultiplier: state.combatMultiplier,
    realmNames: state.realms.map((r) => r.name),
    progression: {
      hpGrowth: formatNumber(progression.hpGrowth, 2),
      attackGrowth: formatNumber(progression.attackGrowth, 2),
      defenseGrowth: formatNumber(progression.defenseGrowth, 2),
      spiritualGrowth: formatNumber(progression.spiritualGrowth, 2),
      divineSenseGrowth: formatNumber(progression.divineSenseGrowth, 2),
      resourceCostMultiplier: formatNumber(progression.resourceCostMultiplier, 2),
    },
    statFields,
    aptitudeFields,
    fiveElements,
    spiritualRootCountOptions,
  };
}

export async function updateSpiritualRoot(elements: FiveElement[]) {
  const current = await prisma.heroConfig.findUnique({ where: { id: 1 } });
  if (!current) throw new Error("HeroConfig 未初始化");
  const aptitude = normalizeAptitude(current.aptitude);
  const rootFields = buildAptitudeSpiritualRoot(elements);
  const next: Aptitude = { ...aptitude, ...rootFields };
  await prisma.heroConfig.update({
    where: { id: 1 },
    data: { aptitude: next },
  });
  revalidateEvaluator();
}

export async function updateHeroStats(stats: HeroStats) {
  await prisma.heroConfig.update({
    where: { id: 1 },
    data: { stats },
  });
  revalidateEvaluator();
}

export async function updateAptitude(aptitude: Aptitude) {
  const normalized = normalizeAptitude(aptitude);
  await prisma.heroConfig.update({
    where: { id: 1 },
    data: { aptitude: normalized },
  });
  revalidateEvaluator();
}

export async function updateCombatMultiplier(combatMultiplier: number) {
  await prisma.heroConfig.update({
    where: { id: 1 },
    data: { combatMultiplier: Math.max(combatMultiplier, 0.1) },
  });
  revalidateEvaluator();
}

export async function updateHeroRealm(heroRealm: string) {
  await prisma.heroConfig.update({
    where: { id: 1 },
    data: { heroRealm, attackerRealm: heroRealm },
  });
  revalidateEvaluator();
}

export async function resetBalanceData() {
  await seedDatabase(prisma);
  revalidateEvaluator();
}
