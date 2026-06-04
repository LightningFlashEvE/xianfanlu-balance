import { getEvaluationContext } from "../calc/context";
import { calculateProgression } from "../calc/progression";
import { calculateRatedPower } from "../calc/rated-power";
import { simulateDuel } from "../calc/duel";
import type { Aptitude, HeroStats } from "../schemas/hero";
import type { EquipmentInstance } from "../schemas/equipment";
import type { ManualInstance } from "../schemas/manual";
import { buildRealmOrderMap, resolveMilestoneEquipmentIds, type RealmOrdered } from "./milestone-loadout";

export type RealmBenchmark = RealmOrdered & { multiplier: number };

export type ProgressionPoint = {
  realm: string;
  heroPower: number;
  mirrorEnemyPower: number;
  nextGatePower: number | null;
  heroVsMirrorWin: number;
  heroVsNextWin: number | null;
  cultivationSpeed: number;
  breakthroughBonus: number;
};

export type CrossRealmRisk = {
  heroRealm: string;
  enemyRealm: string;
  winChance: number;
  powerGap: number;
  verdict: string;
};

export function resolveMilestoneManuals(
  manuals: ManualInstance[],
  targetRealm: string,
  realmOrder: Map<string, number>,
) {
  const targetOrder = realmOrder.get(targetRealm);
  if (targetOrder === undefined) return [];
  return manuals.filter((manual) => {
    const order = realmOrder.get(manual.maxRealm);
    return order !== undefined && order <= targetOrder;
  });
}

function powerAtRealm(params: {
  baseStats: HeroStats;
  aptitude: Aptitude;
  equipment: EquipmentInstance[];
  manuals: ManualInstance[];
  equipmentIds: string[];
  realmMultiplier: number;
  potentialMultiplier: number;
  templateScale?: number;
}) {
  const context = getEvaluationContext({
    baseStats: params.baseStats,
    aptitude: params.aptitude,
    equipment: params.equipment,
    manuals: params.manuals,
    equipmentIds: params.equipmentIds,
    includeManuals: true,
    manualFilter: "milestone",
  });
  return calculateRatedPower({
    stats: context.stats,
    realmMultiplier: params.realmMultiplier,
    potentialMultiplier: params.potentialMultiplier,
    templateScale: params.templateScale ?? 1,
  }).total;
}

function progressionAtRealm(params: {
  baseStats: HeroStats;
  aptitude: Aptitude;
  equipment: EquipmentInstance[];
  manuals: ManualInstance[];
  equipmentIds: string[];
}) {
  const context = getEvaluationContext({
    baseStats: params.baseStats,
    aptitude: params.aptitude,
    equipment: params.equipment,
    manuals: params.manuals,
    equipmentIds: params.equipmentIds,
    includeManuals: true,
    manualFilter: "milestone",
  });
  const progression = calculateProgression(context.growthBonus, params.aptitude);
  return {
    cultivationSpeed: progression.cultivationSpeed,
    breakthroughBonus: progression.breakthroughBonus,
  };
}

export function buildProgressionBenchmark(params: {
  realms: RealmBenchmark[];
  baseStats: HeroStats;
  aptitude: Aptitude;
  equipment: EquipmentInstance[];
  manuals: ManualInstance[];
  combatMultiplier: number;
  enemyTemplateScale?: number;
}): ProgressionPoint[] {
  const realmOrder = buildRealmOrderMap(params.realms);
  const enemyScale = params.enemyTemplateScale ?? 1;

  return params.realms.map((realm, index) => {
    const equipmentIds = resolveMilestoneEquipmentIds(params.equipment, realm.name, realmOrder);
    const milestoneManuals = resolveMilestoneManuals(params.manuals, realm.name, realmOrder);

    const heroPower = powerAtRealm({
      baseStats: params.baseStats,
      aptitude: params.aptitude,
      equipment: params.equipment,
      manuals: milestoneManuals,
      equipmentIds,
      realmMultiplier: realm.multiplier,
      potentialMultiplier: params.combatMultiplier,
    });

    const mirrorEnemyPower = powerAtRealm({
      baseStats: params.baseStats,
      aptitude: params.aptitude,
      equipment: params.equipment,
      manuals: milestoneManuals,
      equipmentIds,
      realmMultiplier: realm.multiplier,
      potentialMultiplier: 1,
    });

    const nextRealm = params.realms[index + 1];
    let nextGatePower: number | null = null;
    let heroVsNextWin: number | null = null;

    if (nextRealm) {
      const nextIds = resolveMilestoneEquipmentIds(params.equipment, nextRealm.name, realmOrder);
      const nextManuals = resolveMilestoneManuals(params.manuals, nextRealm.name, realmOrder);
      nextGatePower = powerAtRealm({
        baseStats: params.baseStats,
        aptitude: params.aptitude,
        equipment: params.equipment,
        manuals: nextManuals,
        equipmentIds: nextIds,
        realmMultiplier: nextRealm.multiplier,
        potentialMultiplier: 1,
        templateScale: enemyScale,
      });

      const heroCtx = getEvaluationContext({
        baseStats: params.baseStats,
        aptitude: params.aptitude,
        equipment: params.equipment,
        manuals: milestoneManuals,
        equipmentIds,
        includeManuals: true,
        manualFilter: "milestone",
      });
      const enemyCtx = getEvaluationContext({
        baseStats: params.baseStats,
        aptitude: params.aptitude,
        equipment: params.equipment,
        manuals: nextManuals,
        equipmentIds: nextIds,
        includeManuals: true,
        manualFilter: "milestone",
      });
      const duel = simulateDuel({
        heroStats: heroCtx.stats,
        enemyStats: enemyCtx.stats,
        heroRealmMultiplier: realm.multiplier,
        enemyRealmMultiplier: nextRealm.multiplier,
        heroPotentialMultiplier: params.combatMultiplier,
        enemyTemplateScale: enemyScale,
      });
      heroVsNextWin = duel.chance;
    }

    const mirrorDuel = simulateDuel({
      heroStats: getEvaluationContext({
        baseStats: params.baseStats,
        aptitude: params.aptitude,
        equipment: params.equipment,
        manuals: milestoneManuals,
        equipmentIds,
        includeManuals: true,
        manualFilter: "milestone",
      }).stats,
      enemyStats: getEvaluationContext({
        baseStats: params.baseStats,
        aptitude: params.aptitude,
        equipment: params.equipment,
        manuals: milestoneManuals,
        equipmentIds,
        includeManuals: true,
        manualFilter: "milestone",
      }).stats,
      heroRealmMultiplier: realm.multiplier,
      enemyRealmMultiplier: realm.multiplier,
      heroPotentialMultiplier: params.combatMultiplier,
      enemyTemplateScale: 1,
    });

    const growth = progressionAtRealm({
      baseStats: params.baseStats,
      aptitude: params.aptitude,
      equipment: params.equipment,
      manuals: milestoneManuals,
      equipmentIds,
    });

    return {
      realm: realm.name,
      heroPower,
      mirrorEnemyPower,
      nextGatePower,
      heroVsMirrorWin: mirrorDuel.chance,
      heroVsNextWin,
      cultivationSpeed: growth.cultivationSpeed,
      breakthroughBonus: growth.breakthroughBonus,
    };
  });
}

export function analyzeProgressionBenchmark(points: ProgressionPoint[]) {
  const weakGates = points.filter((p) => p.heroVsNextWin !== null && p.heroVsNextWin < 0.38);
  const mirrorDrift = points.filter((p) => p.heroVsMirrorWin > 0.68 || p.heroVsMirrorWin < 0.42);
  const worstGate = weakGates.reduce<ProgressionPoint | null>(
    (best, item) =>
      !best || (item.heroVsNextWin ?? 1) < (best.heroVsNextWin ?? 1) ? item : best,
    null,
  );

  if (weakGates.length >= 3) {
    return {
      grade: "跨阶压制偏强",
      summary: "多段对下一境界胜率偏低，玩家易被境界倍率碾压，需补装备段或降低跳变",
      weakGates: weakGates.map((p) => p.realm),
      worstGate: worstGate?.realm ?? null,
      mirrorDrift: mirrorDrift.map((p) => p.realm),
    };
  }
  if (weakGates.length > 0) {
    return {
      grade: "局部跨阶风险",
      summary: worstGate
        ? `${worstGate.realm} 对下一境界偏难，建议检查该段标准养成或倍率`
        : "部分境界跨阶偏难",
      weakGates: weakGates.map((p) => p.realm),
      worstGate: worstGate?.realm ?? null,
      mirrorDrift: mirrorDrift.map((p) => p.realm),
    };
  }
  return {
    grade: "进度轴可接受",
    summary: "标准养成下跨阶守门未出现大面积崩坏，可继续微调单品与倍率",
    weakGates: [] as string[],
    worstGate: null as string | null,
    mirrorDrift: mirrorDrift.map((p) => p.realm),
  };
}

export function findCrossRealmRisks(
  params: {
    realms: RealmBenchmark[];
    baseStats: HeroStats;
    aptitude: Aptitude;
    equipment: EquipmentInstance[];
    manuals: ManualInstance[];
    combatMultiplier: number;
    enemyTemplateScale?: number;
  },
  maxGap = 2,
): CrossRealmRisk[] {
  const realmOrder = buildRealmOrderMap(params.realms);
  const enemyScale = params.enemyTemplateScale ?? 1;
  const risks: CrossRealmRisk[] = [];

  for (let heroIndex = 0; heroIndex < params.realms.length; heroIndex += 1) {
    for (let enemyIndex = heroIndex + 1; enemyIndex < params.realms.length; enemyIndex += 1) {
      const heroRealm = params.realms[heroIndex]!;
      const enemyRealm = params.realms[enemyIndex]!;
      if (enemyIndex - heroIndex > maxGap) continue;

      const heroIds = resolveMilestoneEquipmentIds(params.equipment, heroRealm.name, realmOrder);
      const heroManuals = resolveMilestoneManuals(params.manuals, heroRealm.name, realmOrder);
      const enemyIds = resolveMilestoneEquipmentIds(params.equipment, enemyRealm.name, realmOrder);
      const enemyManuals = resolveMilestoneManuals(params.manuals, enemyRealm.name, realmOrder);

      const heroCtx = getEvaluationContext({
        baseStats: params.baseStats,
        aptitude: params.aptitude,
        equipment: params.equipment,
        manuals: heroManuals,
        equipmentIds: heroIds,
        includeManuals: true,
        manualFilter: "milestone",
      });
      const enemyCtx = getEvaluationContext({
        baseStats: params.baseStats,
        aptitude: params.aptitude,
        equipment: params.equipment,
        manuals: enemyManuals,
        equipmentIds: enemyIds,
        includeManuals: true,
        manualFilter: "milestone",
      });

      const duel = simulateDuel({
        heroStats: heroCtx.stats,
        enemyStats: enemyCtx.stats,
        heroRealmMultiplier: heroRealm.multiplier,
        enemyRealmMultiplier: enemyRealm.multiplier,
        heroPotentialMultiplier: params.combatMultiplier,
        enemyTemplateScale: enemyScale,
      });

      if (duel.chance < 0.42) {
        risks.push({
          heroRealm: heroRealm.name,
          enemyRealm: enemyRealm.name,
          winChance: duel.chance,
          powerGap: duel.gap,
          verdict: duel.verdict,
        });
      }
    }
  }

  return risks.sort((a, b) => a.winChance - b.winChance).slice(0, 5);
}
