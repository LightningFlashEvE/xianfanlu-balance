import {
  calculateRatedPower,
  formatCompact,
  formatNumber,
  getEvaluationContext,
  scalePotentialForCombatant,
  simulateDuel,
  toRatedCombatant,
  type PowerBreakdown,
} from "@xianfanlu/core";
import type { loadBalanceState } from "@/actions/state";

export type SandboxCombatState = Awaited<ReturnType<typeof loadBalanceState>>;

export type SandboxPowerStep = {
  label: string;
  value: string;
  detail?: string;
};

export type SandboxPowerDisplay = {
  total: number;
  totalLabel: string;
  realmName: string;
  realmMultiplier: number;
  templateScale: number;
  equipmentCount: number;
  enabledManualCount?: number;
  steps: SandboxPowerStep[];
};

export type SandboxHeroPower = SandboxPowerDisplay & {
  potentialMultiplier: number;
  enabledManualCount: number;
};

export type SandboxEnemyPower = SandboxPowerDisplay;

export type SandboxDuelSummary = {
  heroTtk: string;
  heroDps: string;
  enemyTtk: string;
  enemyDps: string;
  winChance: string;
  verdict: string;
  powerGap: string;
  powerGapHint: string;
};

function buildRatedPowerSteps(params: {
  breakdown: PowerBreakdown;
  panelLabel: string;
  panelStats: {
    attack: number;
    hp: number;
    hitRate: number;
    level: number;
  };
  panelDetail: string;
  scaledStats: { attack: number; hp: number };
  realmName: string;
  realmMultiplier: number;
  potentialMultiplier: number;
  templateScale: number;
  manualContribution?: number;
}): SandboxPowerStep[] {
  const {
    breakdown,
    panelLabel,
    panelStats,
    panelDetail,
    scaledStats,
    realmName,
    realmMultiplier,
    potentialMultiplier,
    templateScale,
  } = params;
  const realmScale = Math.sqrt(Math.max(realmMultiplier, 0.01));
  const potentialScale = scalePotentialForCombatant(potentialMultiplier);
  const combatScale = realmScale * potentialScale * templateScale;

  const steps: SandboxPowerStep[] = [
    {
      label: panelLabel,
      value: `${formatNumber(panelStats.attack, 0)} 攻 / ${formatNumber(panelStats.hp, 0)} 血`,
      detail: panelDetail,
    },
    {
      label: "境界缩放（√境界倍率）",
      value: `${formatNumber(realmScale, 2)}×`,
      detail: `${realmName}，表内倍率 ${formatNumber(realmMultiplier, 0)}×`,
    },
  ];

  if (Math.abs(potentialMultiplier - 1) > 0.001) {
    steps.push({
      label: "资质/战斗缩放（√combatMultiplier）",
      value: `${formatNumber(potentialScale, 2)}×`,
      detail: `HeroConfig.combatMultiplier = ${formatNumber(potentialMultiplier, 2)}`,
    });
  }

  if (Math.abs(templateScale - 1) > 0.001) {
    steps.push({
      label: "模板强度",
      value: `${formatNumber(templateScale, 2)}×`,
      detail: "敌方模板强度，作用于攻血防等",
    });
  }

  steps.push(
    {
      label: "综合缩放系数",
      value: `${formatNumber(combatScale, 2)}×`,
      detail: "√境界 × √资质 × 模板（与 simulateDuel 一致）",
    },
    {
      label: "缩放后面板（评级用）",
      value: `${formatNumber(scaledStats.attack, 0)} 攻 / ${formatNumber(scaledStats.hp, 0)} 血`,
    },
    {
      label: "武攻 DPS",
      value: formatNumber(breakdown.martialDps, 2),
      detail: "由缩放后面板代入 calculatePower(1, 1)",
    },
    {
      label: "基础战斗分",
      value: formatNumber(breakdown.base, 1),
      detail: "武攻×20 + 生存×0.65 + 资源 + 术法×5",
    },
    {
      label: "等级系数",
      value: `${formatNumber(breakdown.levelFactor, 2)}×`,
      detail: `角色等级 ${panelStats.level}`,
    },
    {
      label: "总评战力",
      value: formatCompact(breakdown.total),
      detail: "与底部「战力差」同源（makeCombatant + calculatePower(1, 1)）",
    },
  );

  if ((params.manualContribution ?? breakdown.manualContribution) > 0) {
    steps.push({
      label: "其中：功法贡献",
      value: formatNumber(breakdown.manualContribution, 1),
      detail: "启用功法相对「无功法」面板的总评增量",
    });
  }

  return steps;
}

export function computeSandboxHeroPower(state: SandboxCombatState): SandboxHeroPower {
  const attackerRealm =
    state.realms.find((r) => r.name === state.attackerRealm) ?? state.realms[0]!;
  const heroContext = getEvaluationContext({
    baseStats: state.stats,
    aptitude: state.aptitude,
    equipment: state.equipment,
    manuals: state.manuals,
    equipmentIds: state.heroEquipmentIds,
    includeManuals: true,
  });
  const heroWithoutManuals = getEvaluationContext({
    baseStats: state.stats,
    aptitude: state.aptitude,
    equipment: state.equipment,
    manuals: state.manuals,
    equipmentIds: state.heroEquipmentIds,
    includeManuals: false,
  });
  const breakdown = calculateRatedPower({
    stats: heroContext.stats,
    realmMultiplier: attackerRealm.multiplier,
    potentialMultiplier: state.combatMultiplier,
    options: { statsWithoutManuals: heroWithoutManuals.stats },
  });
  const combatant = toRatedCombatant(
    heroContext.stats,
    attackerRealm.multiplier,
    state.combatMultiplier,
    1,
  );
  const panel = heroContext.stats;

  return {
    total: breakdown.total,
    totalLabel: formatCompact(breakdown.total),
    realmName: attackerRealm.name,
    realmMultiplier: attackerRealm.multiplier,
    templateScale: 1,
    potentialMultiplier: state.combatMultiplier,
    enabledManualCount: heroContext.activeManuals.length,
    equipmentCount: heroContext.activeEquipment.length,
    steps: buildRatedPowerSteps({
      breakdown,
      panelLabel: "合并面板（基础 + 装备 + 已启用功法）",
      panelStats: {
        attack: panel.attack,
        hp: panel.hp,
        hitRate: panel.hitRate,
        level: panel.level,
      },
      panelDetail: `命中 ${formatNumber(panel.hitRate, 0)} · ${heroContext.activeEquipment.length} 件装备 · ${heroContext.activeManuals.length} 本功法`,
      scaledStats: { attack: combatant.attack, hp: combatant.hp },
      realmName: attackerRealm.name,
      realmMultiplier: attackerRealm.multiplier,
      potentialMultiplier: state.combatMultiplier,
      templateScale: 1,
    }),
  };
}

export function computeSandboxEnemyPower(state: SandboxCombatState): SandboxEnemyPower {
  const defenderRealm =
    state.realms.find((r) => r.name === state.defenderRealm) ?? state.realms[0]!;
  const enemyContext = getEvaluationContext({
    baseStats: state.stats,
    aptitude: state.aptitude,
    equipment: state.equipment,
    manuals: state.manuals,
    equipmentIds: state.enemyEquipmentIds,
    includeManuals: false,
  });
  const breakdown = calculateRatedPower({
    stats: enemyContext.stats,
    realmMultiplier: defenderRealm.multiplier,
    potentialMultiplier: 1,
    templateScale: state.enemyTemplateScale,
  });
  const combatant = toRatedCombatant(
    enemyContext.stats,
    defenderRealm.multiplier,
    1,
    state.enemyTemplateScale,
  );
  const panel = enemyContext.stats;

  return {
    total: breakdown.total,
    totalLabel: formatCompact(breakdown.total),
    realmName: defenderRealm.name,
    realmMultiplier: defenderRealm.multiplier,
    templateScale: state.enemyTemplateScale,
    equipmentCount: enemyContext.activeEquipment.length,
    steps: buildRatedPowerSteps({
      breakdown,
      panelLabel: "合并面板（基础 + 装备，无功法）",
      panelStats: {
        attack: panel.attack,
        hp: panel.hp,
        hitRate: panel.hitRate,
        level: panel.level,
      },
      panelDetail: `${enemyContext.activeEquipment.length} 件装备 · 命中 ${formatNumber(panel.hitRate, 0)}`,
      scaledStats: { attack: combatant.attack, hp: combatant.hp },
      realmName: defenderRealm.name,
      realmMultiplier: defenderRealm.multiplier,
      potentialMultiplier: 1,
      templateScale: state.enemyTemplateScale,
    }),
  };
}

export function computeSandboxDuel(state: SandboxCombatState): SandboxDuelSummary {
  const attackerRealm =
    state.realms.find((r) => r.name === state.attackerRealm) ?? state.realms[0]!;
  const defenderRealm =
    state.realms.find((r) => r.name === state.defenderRealm) ?? state.realms[0]!;
  const heroContext = getEvaluationContext({
    baseStats: state.stats,
    aptitude: state.aptitude,
    equipment: state.equipment,
    manuals: state.manuals,
    equipmentIds: state.heroEquipmentIds,
    includeManuals: true,
  });
  const enemyContext = getEvaluationContext({
    baseStats: state.stats,
    aptitude: state.aptitude,
    equipment: state.equipment,
    manuals: state.manuals,
    equipmentIds: state.enemyEquipmentIds,
    includeManuals: false,
  });
  const duel = simulateDuel({
    heroStats: heroContext.stats,
    enemyStats: enemyContext.stats,
    heroRealmMultiplier: attackerRealm.multiplier,
    enemyRealmMultiplier: defenderRealm.multiplier,
    heroPotentialMultiplier: state.combatMultiplier,
    enemyTemplateScale: state.enemyTemplateScale,
  });

  return {
    heroTtk: `${formatNumber(duel.heroTtk, 1)} 秒`,
    heroDps: `DPS ${formatNumber(duel.heroDps, 1)}`,
    enemyTtk: `${formatNumber(duel.enemyTtk, 1)} 秒`,
    enemyDps: `DPS ${formatNumber(duel.enemyDps, 1)}`,
    winChance: `${formatNumber(duel.chance * 100, 1)}%`,
    verdict: duel.verdict,
    powerGap: `${formatNumber(duel.gap, 2)}x`,
    powerGapHint: `${state.attackerRealm} 对 ${state.defenderRealm}`,
  };
}

export function computeSandboxCombat(state: SandboxCombatState) {
  return {
    duel: computeSandboxDuel(state),
    heroPower: computeSandboxHeroPower(state),
    enemyPower: computeSandboxEnemyPower(state),
  };
}
