"use server";

import { revalidateBalancePages } from "@/lib/revalidate-paths";
import {
  analyzeCurve,
  analyzeProgressionBenchmark,
  buildBalanceExport,
  buildProgressionBenchmark,
  migrateLegacyBalanceRealm,
  migrateLegacyItemQuality,
  migrateLegacyMaxRealm,
  normalizeEquipmentCategory,
  normalizeEquipmentSlot,
  calculateRatedPower,
  findCrossRealmRisks,
  formatCompact,
  formatNumber,
  signedPercent,
} from "@xianfanlu/core";
import { prisma } from "@/lib/db";
import { loadBalanceState } from "./state";
import { getMilestoneEvaluation } from "@/lib/milestone-eval";

export async function getEvaluatorSummary() {
  const state = await loadBalanceState();
  const realm = state.realms.find((r) => r.name === state.heroRealm) ?? state.realms[0]!;
  const { context, contextWithoutManuals, equipmentIds, milestoneManuals } =
    getMilestoneEvaluation(state);
  const breakdown = calculateRatedPower({
    stats: context.stats,
    realmMultiplier: realm.multiplier,
    potentialMultiplier: state.combatMultiplier,
    options: { statsWithoutManuals: contextWithoutManuals.stats },
  });
  const analysis = analyzeCurve(
    state.realms.map((r) => ({ name: r.name, multiplier: r.multiplier })),
  );
  const progressionPoints = buildProgressionBenchmark({
    realms: state.realms.map((r) => ({
      name: r.name,
      multiplier: r.multiplier,
      sortOrder: r.sortOrder,
    })),
    baseStats: state.stats,
    aptitude: state.aptitude,
    equipment: state.equipment,
    manuals: state.manuals,
    combatMultiplier: state.combatMultiplier,
    enemyTemplateScale: state.enemyTemplateScale,
  });
  const progressionAnalysis = analyzeProgressionBenchmark(progressionPoints);

  return {
    powerScore: formatCompact(breakdown.total),
    powerHint: `${state.heroRealm}（评级战力 √境界缩放），标准养成 ${equipmentIds.length} 件装备 / ${milestoneManuals.length} 本功法`,
    realmSpan: `${formatNumber(analysis.span, 0)}x`,
    realmSpanHint: `${state.realms[0]?.name} -> ${state.realms[state.realms.length - 1]?.name}`,
    maxJump: `${formatNumber(analysis.maxJump.jump, 2)}x`,
    maxJumpHint: `${analysis.maxJump.from} -> ${analysis.maxJump.to}`,
    balanceGrade: progressionAnalysis.grade,
    balanceSummary: progressionAnalysis.summary,
    realmBalanceGrade: analysis.grade,
    realmBalanceSummary: analysis.summary,
    cultivationSpeed: `${formatNumber(context.progression.cultivationSpeed, 0)}%`,
    cultivationHint: `资质 x${formatNumber(context.progression.aptitudeSpeedMultiplier, 2)}，功法 x${formatNumber(context.progression.manualSpeedMultiplier, 2)}`,
    breakthrough: signedPercent(context.progression.breakthroughBonus),
    breakthroughHint: `副作用风险 ${formatNumber(context.progression.sideEffectRisk, 0)}，资源消耗 x${formatNumber(context.progression.resourceCostMultiplier, 2)}`,
    opportunity: signedPercent(context.progression.opportunityBonus),
    opportunityHint: `${state.aptitude.spiritualRoot}，气运 ${state.aptitude.luck}/10`,
    counts: {
      realms: state.realms.length,
      equipment: state.equipment.length,
      manuals: state.manuals.length,
      milestoneManuals: milestoneManuals.length,
      milestoneEquipment: equipmentIds.length,
    },
    breakdown: {
      base: formatNumber(breakdown.base, 1),
      martialDps: formatNumber(breakdown.martialDps, 2),
      durability: formatNumber(breakdown.durability, 1),
      resource: formatNumber(breakdown.resource, 1),
      mystic: formatNumber(breakdown.mystic, 1),
      activeItems: context.activeEquipment.length + context.activeManuals.length,
      levelFactor: formatNumber(breakdown.levelFactor, 2),
      manualContribution: formatNumber(breakdown.manualContribution, 1),
    },
    analysis,
  };
}

export async function getProgressionChartData() {
  const state = await loadBalanceState();
  const realms = state.realms.map((r) => ({
    name: r.name,
    multiplier: r.multiplier,
    sortOrder: r.sortOrder,
  }));
  const params = {
    realms,
    baseStats: state.stats,
    aptitude: state.aptitude,
    equipment: state.equipment,
    manuals: state.manuals,
    combatMultiplier: state.combatMultiplier,
    enemyTemplateScale: state.enemyTemplateScale,
  };
  const points = buildProgressionBenchmark(params);
  return {
    heroRealm: state.heroRealm,
    points,
    analysis: analyzeProgressionBenchmark(points),
    crossRealmRisks: findCrossRealmRisks(params),
    realmCurve: analyzeCurve(realms.map((r) => ({ name: r.name, multiplier: r.multiplier }))),
  };
}

export async function listRealms() {
  const realms = await prisma.realm.findMany({ orderBy: { sortOrder: "asc" } });
  return realms.map((r) => ({ id: r.id, name: r.name, multiplier: r.multiplier }));
}

export async function updateRealmMultiplier(id: number, multiplier: number) {
  await prisma.realm.update({ where: { id }, data: { multiplier } });
  revalidateBalancePages();
}

export async function listEquipment() {
  const rows = await prisma.equipment.findMany({ orderBy: { externalId: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    externalId: row.externalId,
    name: row.name,
    slot: row.slot,
    category: row.category,
    quality: row.quality,
    enabled: row.enabled,
    note: row.note,
  }));
}

export async function listManuals() {
  const rows = await prisma.manual.findMany({ orderBy: { externalId: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    externalId: row.externalId,
    name: row.name,
    type: row.type,
    rank: row.rank,
    quality: row.quality,
    enabled: row.enabled,
    level: row.level,
    proficiency: row.proficiency,
    maxRealm: row.maxRealm,
  }));
}

export async function exportBalanceJson() {
  const [realms, equipmentRows, manualRows] = await Promise.all([
    prisma.realm.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.equipment.findMany(),
    prisma.manual.findMany(),
  ]);

  const payload = buildBalanceExport({
    realms: realms.map((r) => ({ name: r.name, multiplier: r.multiplier })),
    equipment: equipmentRows.map((e) => {
      const slot = normalizeEquipmentSlot(e.slot);
      return {
      id: e.externalId,
      name: e.name,
      slot,
      category: normalizeEquipmentCategory(slot, e.category),
      quality: migrateLegacyItemQuality(e.quality),
      balanceRealm: migrateLegacyBalanceRealm(e.balanceRealm),
      combat: (e.combat as Record<string, number>) ?? {},
      growth: (e.growth as Record<string, number>) ?? {},
      note: e.note,
    };
    }),
    manuals: manualRows.map((m) => ({
      id: m.externalId,
      name: m.name,
      type: m.type,
      rank: m.rank,
      quality: migrateLegacyItemQuality(m.quality),
      maxRealm: migrateLegacyMaxRealm(m.maxRealm),
      combat: (m.combat as Record<string, number>) ?? {},
      growth: (m.growth as Record<string, number>) ?? {},
      note: m.note,
    })),
  });

  return JSON.stringify(payload, null, 2);
}
