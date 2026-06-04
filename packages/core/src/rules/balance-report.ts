import { getEvaluationContext } from "../calc/context";
import { calculateRatedPower } from "../calc/rated-power";
import { simulateDuel } from "../calc/duel";
import {
  buildBalanceBandOrderMap,
  mapRealmNameToBalanceBand,
  migrateLegacyBalanceRealm,
} from "../data/balance-realm-bands";
import type { Aptitude, HeroStats } from "../schemas/hero";
import type { EquipmentInstance } from "../schemas/equipment";
import type { ManualInstance } from "../schemas/manual";
import {
  buildProgressionBenchmark,
  findCrossRealmRisks,
  resolveMilestoneManuals,
  type CrossRealmRisk,
} from "./progression-benchmark";
import { buildRealmOrderMap, resolveMilestoneEquipmentIds } from "./milestone-loadout";
import { getLoadoutLimit } from "./loadout";
import {
  getChapterBossTemplateScale,
  sandboxEnemyPresetDefs,
} from "../data/sandbox-enemy-presets";
import {
  resolveAllSandboxEnemyPresets,
  resolveChapterBossDefenderRealm,
  resolveChapterBossEnemyEquipmentIds,
} from "./sandbox-enemy-preset";
import type { BalanceAdjustmentHints } from "../schemas/balance-report";
import type {
  summarizeEquipmentCatalog,
  summarizeHeroBaseline,
} from "./balance-adjustment-hints";

export type BalanceReportState = {
  realms: { name: string; multiplier: number; sortOrder: number }[];
  equipment: EquipmentInstance[];
  manuals: ManualInstance[];
  stats: HeroStats;
  aptitude: Aptitude;
  combatMultiplier: number;
  heroEquipmentIds: string[];
  enemyEquipmentIds: string[];
  attackerRealm: string;
  defenderRealm: string;
  enemyTemplateScale: number;
  baseBagCapacity: number;
};

export type DuelSnapshot = {
  winChance: number;
  powerGap: number;
  verdict: string;
  heroPower: number;
  enemyPower: number;
};

export type BotStrategyId = "milestone_standard" | "sandbox_current" | "no_manuals";

export type BalanceMatchRow = {
  kind: "preset" | "current_defender";
  presetBandId?: string;
  presetLabel?: string;
  defenderRealm: string;
  enemyTemplateScale: number;
  duel: DuelSnapshot;
};

export type BotStrategyReport = {
  id: BotStrategyId;
  label: string;
  heroEquipmentCount: number;
  enabledManualCount: number;
  matches: BalanceMatchRow[];
};

export type RealmGateMatch = {
  nextRealm: string;
  duel: DuelSnapshot;
};

export type RealmBandPresetMatch = {
  presetBandId: string;
  presetLabel: string;
  defenderRealm: string;
  duel: DuelSnapshot;
};

export type RealmSweepRow = {
  realm: string;
  equipmentCount: number;
  manualCount: number;
  heroPower: number;
  manualContribution: number;
  manualPowerShare: number;
  vsNextGate: RealmGateMatch | null;
  vsBandPreset: RealmBandPresetMatch | null;
};

export type LoadoutAuditRow = {
  realm: string;
  wearSlotFill: number;
  bagItemCount: number;
  manualCount: number;
  manualPowerShare: number;
  powerDeltaPrev: number | null;
  manualDeltaPrev: number | null;
  equipDeltaPrev: number | null;
  libraryItemsInBand: number;
  issues: string[];
};

export type BalanceReportPayload = {
  meta: {
    generatedAt: string;
    combatMultiplier: number;
    enemyTemplateScale: number;
    attackerRealm: string;
    defenderRealm: string;
  };
  sandboxCurrent: {
    attackerRealm: string;
    defenderRealm: string;
    heroPower: number;
    enemyPower: number;
    duel: DuelSnapshot;
  };
  progression: {
    realm: string;
    heroPower: number;
    nextGatePower: number | null;
    heroVsNextWin: number | null;
    heroVsMirrorWin: number;
    cultivationSpeed: number;
  }[];
  crossRealmRisks: CrossRealmRisk[];
  botStrategies: BotStrategyReport[];
  realmSweep: RealmSweepRow[];
  loadoutAudit: LoadoutAuditRow[];
};

export type RuleFlagSeverity = "info" | "warn" | "critical";

export type BalanceRuleFlag = {
  code: string;
  severity: RuleFlagSeverity;
  evidence: string;
};

/** 发给 LLM 的精简报告（去掉完整 bot 对战快照等大字段） */
export type BalanceReportAiPayload = {
  meta: BalanceReportPayload["meta"];
  sandboxCurrent: {
    attackerRealm: string;
    defenderRealm: string;
    heroPower: number;
    enemyPower: number;
    winChance: number;
    powerGap: number;
    verdict: string;
  };
  realmSweep: {
    realm: string;
    equipmentCount: number;
    manualCount: number;
    heroPower: number;
    manualPowerShare: number;
    nextRealm: string | null;
    nextGateWin: number | null;
    chapterBossLabel: string | null;
    chapterBossWin: number | null;
  }[];
  loadoutIssues: {
    realm: string;
    issues: string[];
    wearSlotFill: number;
    manualCount: number;
    manualPowerShare: number;
    libraryItemsInBand: number;
  }[];
  progressionGates: {
    realm: string;
    heroPower: number;
    heroVsNextWin: number | null;
  }[];
  crossRealmRisks: {
    heroRealm: string;
    enemyRealm: string;
    winChance: number;
    powerGap: number;
  }[];
  currentRealmBots: {
    id: BotStrategyId;
    label: string;
    equipmentCount: number;
    manualCount: number;
    matches: {
      opponent: string;
      defenderRealm: string;
      winChance: number;
      powerGap: number;
    }[];
  }[];
  ruleFlags: BalanceRuleFlag[];
  heroBaseline?: ReturnType<typeof summarizeHeroBaseline>;
  equipmentCatalog?: ReturnType<typeof summarizeEquipmentCatalog>;
  deterministicHints?: BalanceAdjustmentHints;
};

function roundReportRate(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export type BuildBalanceReportForAiOptions = {
  heroBaseline?: BalanceReportAiPayload["heroBaseline"];
  equipmentCatalog?: BalanceReportAiPayload["equipmentCatalog"];
  deterministicHints?: BalanceAdjustmentHints;
};

/** 发给 LLM 的完整报告（含 realmSweep 明细、loadoutAudit、botStrategies 等） */
export type BalanceReportAiInput = BalanceReportPayload & {
  ruleFlags: BalanceRuleFlag[];
  heroBaseline?: BuildBalanceReportForAiOptions["heroBaseline"];
  equipmentCatalog?: BuildBalanceReportForAiOptions["equipmentCatalog"];
  deterministicHints?: BalanceAdjustmentHints;
};

/** 完整 payload + 规则与人物/装备上下文，供 MiniMax 评审 */
export function buildBalanceReportAiInput(
  payload: BalanceReportPayload,
  ruleFlags: BalanceRuleFlag[],
  options?: BuildBalanceReportForAiOptions,
): BalanceReportAiInput {
  return {
    ...payload,
    ruleFlags,
    ...(options?.heroBaseline ? { heroBaseline: options.heroBaseline } : {}),
    ...(options?.equipmentCatalog ? { equipmentCatalog: options.equipmentCatalog } : {}),
    ...(options?.deterministicHints ? { deterministicHints: options.deterministicHints } : {}),
  };
}

export function buildBalanceReportForAi(
  payload: BalanceReportPayload,
  ruleFlags: BalanceRuleFlag[],
  options?: BuildBalanceReportForAiOptions,
): BalanceReportAiPayload {
  const cur = payload.sandboxCurrent;
  return {
    meta: payload.meta,
    sandboxCurrent: {
      attackerRealm: cur.attackerRealm,
      defenderRealm: cur.defenderRealm,
      heroPower: cur.heroPower,
      enemyPower: cur.enemyPower,
      winChance: roundReportRate(cur.duel.winChance),
      powerGap: roundReportRate(cur.duel.powerGap),
      verdict: cur.duel.verdict,
    },
    realmSweep: payload.realmSweep.map((row) => ({
      realm: row.realm,
      equipmentCount: row.equipmentCount,
      manualCount: row.manualCount,
      heroPower: row.heroPower,
      manualPowerShare: row.manualPowerShare,
      nextRealm: row.vsNextGate?.nextRealm ?? null,
      nextGateWin: row.vsNextGate ? roundReportRate(row.vsNextGate.duel.winChance) : null,
      chapterBossLabel: row.vsBandPreset?.presetLabel ?? null,
      chapterBossWin: row.vsBandPreset ? roundReportRate(row.vsBandPreset.duel.winChance) : null,
    })),
    loadoutIssues: payload.loadoutAudit
      .filter((a) => a.issues.length > 0)
      .map((a) => ({
        realm: a.realm,
        issues: a.issues,
        wearSlotFill: a.wearSlotFill,
        manualCount: a.manualCount,
        manualPowerShare: a.manualPowerShare,
        libraryItemsInBand: a.libraryItemsInBand,
      })),
    progressionGates: payload.progression.map((p) => ({
      realm: p.realm,
      heroPower: p.heroPower,
      heroVsNextWin: p.heroVsNextWin,
    })),
    crossRealmRisks: payload.crossRealmRisks.slice(0, 8).map((r) => ({
      heroRealm: r.heroRealm,
      enemyRealm: r.enemyRealm,
      winChance: roundReportRate(r.winChance),
      powerGap: roundReportRate(r.powerGap),
    })),
    currentRealmBots: payload.botStrategies.map((bot) => ({
      id: bot.id,
      label: bot.label,
      equipmentCount: bot.heroEquipmentCount,
      manualCount: bot.enabledManualCount,
      matches: bot.matches.map((m) => ({
        opponent: m.kind === "preset" ? (m.presetLabel ?? m.presetBandId ?? "?") : "当前守方",
        defenderRealm: m.defenderRealm,
        winChance: roundReportRate(m.duel.winChance),
        powerGap: roundReportRate(m.duel.powerGap),
      })),
    })),
    ruleFlags,
    ...(options?.heroBaseline ? { heroBaseline: options.heroBaseline } : {}),
    ...(options?.equipmentCatalog ? { equipmentCatalog: options.equipmentCatalog } : {}),
    ...(options?.deterministicHints ? { deterministicHints: options.deterministicHints } : {}),
  };
}

const BOT_DEFS: { id: BotStrategyId; label: string }[] = [
  { id: "milestone_standard", label: "标准里程碑养成" },
  { id: "sandbox_current", label: "沙盘当前配装" },
  { id: "no_manuals", label: "沙盘配装（无功法）" },
];

const NEXT_GATE_LOW = 0.38;
const NEXT_GATE_HIGH = 0.72;
const CHAPTER_BOSS_LOW = 0.25;
const CHAPTER_BOSS_HIGH = 0.55;

function realmMultiplier(state: BalanceReportState, name: string): number {
  return state.realms.find((r) => r.name === name)?.multiplier ?? 1;
}

function duelFromSimulate(
  state: BalanceReportState,
  heroStats: HeroStats,
  enemyStats: HeroStats,
  heroRealm: string,
  enemyRealm: string,
  enemyTemplateScale: number,
): DuelSnapshot {
  const duel = simulateDuel({
    heroStats,
    enemyStats,
    heroRealmMultiplier: realmMultiplier(state, heroRealm),
    enemyRealmMultiplier: realmMultiplier(state, enemyRealm),
    heroPotentialMultiplier: state.combatMultiplier,
    enemyTemplateScale,
  });
  const heroRealmMult = realmMultiplier(state, heroRealm);
  const enemyRealmMult = realmMultiplier(state, enemyRealm);
  const heroPower = calculateRatedPower({
    stats: heroStats,
    realmMultiplier: heroRealmMult,
    potentialMultiplier: state.combatMultiplier,
  }).total;
  const enemyPower = calculateRatedPower({
    stats: enemyStats,
    realmMultiplier: enemyRealmMult,
    potentialMultiplier: 1,
    templateScale: enemyTemplateScale,
  }).total;
  return {
    winChance: Math.round(duel.chance * 1000) / 1000,
    powerGap: Math.round(duel.gap * 100) / 100,
    verdict: duel.verdict,
    heroPower: Math.round(heroPower),
    enemyPower: Math.round(enemyPower),
  };
}

function heroContextForMilestone(state: BalanceReportState, heroRealm: string) {
  const realmOrder = buildRealmOrderMap(state.realms);
  const equipmentIds = resolveMilestoneEquipmentIds(
    state.equipment,
    heroRealm,
    realmOrder,
  );
  const milestoneManuals = resolveMilestoneManuals(
    state.manuals,
    heroRealm,
    realmOrder,
  );
  return getEvaluationContext({
    baseStats: state.stats,
    aptitude: state.aptitude,
    equipment: state.equipment,
    manuals: milestoneManuals,
    equipmentIds,
    includeManuals: true,
    manualFilter: "milestone",
  });
}

function enemyContextForMilestone(state: BalanceReportState, defenderRealm: string) {
  const realmOrder = buildRealmOrderMap(state.realms);
  const equipmentIds = resolveMilestoneEquipmentIds(
    state.equipment,
    defenderRealm,
    realmOrder,
  );
  const milestoneManuals = resolveMilestoneManuals(
    state.manuals,
    defenderRealm,
    realmOrder,
  );
  return getEvaluationContext({
    baseStats: state.stats,
    aptitude: state.aptitude,
    equipment: state.equipment,
    manuals: milestoneManuals,
    equipmentIds,
    includeManuals: true,
    manualFilter: "milestone",
  });
}

function heroContextForBot(state: BalanceReportState, botId: BotStrategyId) {
  if (botId === "milestone_standard") {
    return heroContextForMilestone(state, state.attackerRealm);
  }
  return getEvaluationContext({
    baseStats: state.stats,
    aptitude: state.aptitude,
    equipment: state.equipment,
    manuals: state.manuals,
    equipmentIds: state.heroEquipmentIds,
    includeManuals: botId !== "no_manuals",
    manualFilter: "enabled",
  });
}

function countWearSlotsFilled(
  equipment: EquipmentInstance[],
  equipmentIds: string[],
): { wearSlotFill: number; bagItemCount: number } {
  const items = equipmentIds
    .map((id) => equipment.find((item) => item.instanceId === id))
    .filter((item): item is EquipmentInstance => Boolean(item));
  const wearKeys = new Set<string>();
  let bagCount = 0;
  for (const item of items) {
    const limit = getLoadoutLimit(item);
    if (limit) wearKeys.add(limit.key);
    else bagCount += 1;
  }
  return { wearSlotFill: wearKeys.size, bagItemCount: bagCount };
}

function libraryCountForBand(equipment: EquipmentInstance[], bandId: string): number {
  const bandOrder = buildBalanceBandOrderMap();
  const targetOrder = bandOrder.get(migrateLegacyBalanceRealm(bandId));
  if (targetOrder === undefined) return 0;
  return equipment.filter((item) => {
    const band = migrateLegacyBalanceRealm(item.balanceRealm ?? "");
    const order = bandOrder.get(band);
    return order !== undefined && order >= 0 && order <= targetOrder;
  }).length;
}

export function buildRealmSweep(state: BalanceReportState): RealmSweepRow[] {
  const presets = resolveAllSandboxEnemyPresets(state.equipment, state.baseBagCapacity);
  const sortedRealms = [...state.realms].sort((a, b) => a.sortOrder - b.sortOrder);

  return sortedRealms.map((realm, index) => {
    const heroRealm = realm.name;
    const heroCtx = heroContextForMilestone(state, heroRealm);
    const heroRealmMult = realmMultiplier(state, heroRealm);
    const heroPower = calculateRatedPower({
      stats: heroCtx.stats,
      realmMultiplier: heroRealmMult,
      potentialMultiplier: state.combatMultiplier,
    }).total;

    const heroWithoutManuals = getEvaluationContext({
      baseStats: state.stats,
      aptitude: state.aptitude,
      equipment: state.equipment,
      manuals: heroCtx.activeManuals,
      equipmentIds: heroCtx.activeEquipment.map((e) => e.instanceId),
      includeManuals: false,
      manualFilter: "milestone",
    });
    const powerWithoutManuals = calculateRatedPower({
      stats: heroWithoutManuals.stats,
      realmMultiplier: heroRealmMult,
      potentialMultiplier: state.combatMultiplier,
    }).total;
    const manualContribution = Math.max(0, heroPower - powerWithoutManuals);
    const manualPowerShare = heroPower > 0 ? manualContribution / heroPower : 0;

    let vsNextGate: RealmGateMatch | null = null;
    const nextRealm = sortedRealms[index + 1];
    if (nextRealm) {
      const enemyCtx = enemyContextForMilestone(state, nextRealm.name);
      vsNextGate = {
        nextRealm: nextRealm.name,
        duel: duelFromSimulate(
          state,
          heroCtx.stats,
          enemyCtx.stats,
          heroRealm,
          nextRealm.name,
          state.enemyTemplateScale,
        ),
      };
    }

    let vsBandPreset: RealmBandPresetMatch | null = null;
    const bandId = mapRealmNameToBalanceBand(heroRealm);
    const presetDef = sandboxEnemyPresetDefs.find((d) => d.bandId === bandId);
    const preset = presets.find((p) => p.bandId === bandId);
    if (presetDef && preset) {
      const bossDefenderRealm = resolveChapterBossDefenderRealm(heroRealm, sortedRealms);
      let bossScale = getChapterBossTemplateScale(bandId);
      const heroBand = mapRealmNameToBalanceBand(heroRealm);
      const bossBand = mapRealmNameToBalanceBand(bossDefenderRealm);
      if (bossBand !== heroBand) {
        bossScale = Math.min(bossScale, 0.9);
      }
      const heroOrder = sortedRealms.findIndex((r) => r.name === heroRealm);
      const bossOrder = sortedRealms.findIndex((r) => r.name === bossDefenderRealm);
      if (bossOrder <= heroOrder) {
        bossScale = Math.max(bossScale, 1.04);
      }
      const bossEquipmentIds = resolveChapterBossEnemyEquipmentIds(
        state.equipment,
        bossDefenderRealm,
        state.baseBagCapacity,
      );
      const realmOrder = buildRealmOrderMap(state.realms);
      const enemyManuals = resolveMilestoneManuals(
        state.manuals,
        bossDefenderRealm,
        realmOrder,
      );
      const presetEnemyCtx = getEvaluationContext({
        baseStats: state.stats,
        aptitude: state.aptitude,
        equipment: state.equipment,
        manuals: enemyManuals,
        equipmentIds: bossEquipmentIds,
        includeManuals: true,
        manualFilter: "milestone",
      });
      vsBandPreset = {
        presetBandId: preset.bandId,
        presetLabel: preset.label,
        defenderRealm: bossDefenderRealm,
        duel: duelFromSimulate(
          state,
          heroCtx.stats,
          presetEnemyCtx.stats,
          heroRealm,
          bossDefenderRealm,
          bossScale,
        ),
      };
    }

    return {
      realm: heroRealm,
      equipmentCount: heroCtx.activeEquipment.length,
      manualCount: heroCtx.activeManuals.length,
      heroPower: Math.round(heroPower),
      manualContribution: Math.round(manualContribution),
      manualPowerShare: Math.round(manualPowerShare * 1000) / 1000,
      vsNextGate,
      vsBandPreset,
    };
  });
}

export function buildLoadoutAudit(
  state: BalanceReportState,
  realmSweep: RealmSweepRow[],
): LoadoutAuditRow[] {
  const realmOrder = buildRealmOrderMap(state.realms);

  return realmSweep.map((row, index) => {
    const prev = index > 0 ? (realmSweep.at(index - 1) ?? null) : null;
    const equipmentIds = resolveMilestoneEquipmentIds(
      state.equipment,
      row.realm,
      realmOrder,
    );
    const { wearSlotFill, bagItemCount } = countWearSlotsFilled(state.equipment, equipmentIds);
    const bandId = mapRealmNameToBalanceBand(row.realm);
    const libraryItemsInBand = libraryCountForBand(state.equipment, bandId);

    const powerDeltaPrev =
      prev && prev.heroPower > 0 ? row.heroPower / prev.heroPower : null;
    const manualDeltaPrev = prev !== null ? row.manualCount - prev.manualCount : null;
    const equipDeltaPrev = prev !== null ? row.equipmentCount - prev.equipmentCount : null;

    const issues: string[] = [];
    if (wearSlotFill < 6) issues.push("equip_underfill");
    if (manualDeltaPrev !== null && manualDeltaPrev >= 5) issues.push("manual_spike");
    if (
      powerDeltaPrev !== null &&
      powerDeltaPrev > 2.5 &&
      equipDeltaPrev !== null &&
      equipDeltaPrev <= 1
    ) {
      issues.push("power_cliff");
    }
    if (row.manualPowerShare > 0.45) issues.push("manual_dominated");
    if (libraryItemsInBand < 3) issues.push("library_sparse");

    return {
      realm: row.realm,
      wearSlotFill,
      bagItemCount,
      manualCount: row.manualCount,
      manualPowerShare: row.manualPowerShare,
      powerDeltaPrev:
        powerDeltaPrev !== null ? Math.round(powerDeltaPrev * 100) / 100 : null,
      manualDeltaPrev,
      equipDeltaPrev,
      libraryItemsInBand,
      issues,
    };
  });
}

function buildBotMatches(
  state: BalanceReportState,
  botId: BotStrategyId,
  presets: ReturnType<typeof resolveAllSandboxEnemyPresets>,
): BalanceMatchRow[] {
  const heroCtx = heroContextForBot(state, botId);
  const realmOrder = buildRealmOrderMap(state.realms);
  const matches: BalanceMatchRow[] = [];

  for (const preset of presets) {
    const enemyManuals = resolveMilestoneManuals(
      state.manuals,
      preset.defenderRealm,
      realmOrder,
    );
    const enemyCtx = getEvaluationContext({
      baseStats: state.stats,
      aptitude: state.aptitude,
      equipment: state.equipment,
      manuals: enemyManuals,
      equipmentIds: preset.enemyEquipmentIds,
      includeManuals: true,
      manualFilter: "milestone",
    });
    matches.push({
      kind: "preset",
      presetBandId: preset.bandId,
      presetLabel: preset.label,
      defenderRealm: preset.defenderRealm,
      enemyTemplateScale: preset.enemyTemplateScale,
      duel: duelFromSimulate(
        state,
        heroCtx.stats,
        enemyCtx.stats,
        state.attackerRealm,
        preset.defenderRealm,
        preset.enemyTemplateScale,
      ),
    });
  }

  const currentEnemyCtx = getEvaluationContext({
    baseStats: state.stats,
    aptitude: state.aptitude,
    equipment: state.equipment,
    manuals: state.manuals,
    equipmentIds: state.enemyEquipmentIds,
    includeManuals: false,
  });
  matches.push({
    kind: "current_defender",
    defenderRealm: state.defenderRealm,
    enemyTemplateScale: state.enemyTemplateScale,
    duel: duelFromSimulate(
      state,
      heroCtx.stats,
      currentEnemyCtx.stats,
      state.attackerRealm,
      state.defenderRealm,
      state.enemyTemplateScale,
    ),
  });

  return matches;
}

export function buildBalanceReportPayload(state: BalanceReportState): BalanceReportPayload {
  const presets = resolveAllSandboxEnemyPresets(state.equipment, state.baseBagCapacity);
  const realmBenchmarks = state.realms.map((r) => ({
    name: r.name,
    multiplier: r.multiplier,
    sortOrder: r.sortOrder,
  }));

  const heroCtx = getEvaluationContext({
    baseStats: state.stats,
    aptitude: state.aptitude,
    equipment: state.equipment,
    manuals: state.manuals,
    equipmentIds: state.heroEquipmentIds,
    includeManuals: true,
    manualFilter: "enabled",
  });
  const enemyCtx = getEvaluationContext({
    baseStats: state.stats,
    aptitude: state.aptitude,
    equipment: state.equipment,
    manuals: state.manuals,
    equipmentIds: state.enemyEquipmentIds,
    includeManuals: false,
  });

  const currentDuel = duelFromSimulate(
    state,
    heroCtx.stats,
    enemyCtx.stats,
    state.attackerRealm,
    state.defenderRealm,
    state.enemyTemplateScale,
  );

  const progressionPoints = buildProgressionBenchmark({
    realms: realmBenchmarks,
    baseStats: state.stats,
    aptitude: state.aptitude,
    equipment: state.equipment,
    manuals: state.manuals,
    combatMultiplier: state.combatMultiplier,
    enemyTemplateScale: state.enemyTemplateScale,
  });

  const crossRealmRisks = findCrossRealmRisks({
    realms: realmBenchmarks,
    baseStats: state.stats,
    aptitude: state.aptitude,
    equipment: state.equipment,
    manuals: state.manuals,
    combatMultiplier: state.combatMultiplier,
    enemyTemplateScale: state.enemyTemplateScale,
  });

  const realmSweep = buildRealmSweep(state);
  const loadoutAudit = buildLoadoutAudit(state, realmSweep);

  const botStrategies: BotStrategyReport[] = BOT_DEFS.map((def) => {
    const ctx = heroContextForBot(state, def.id);
    return {
      id: def.id,
      label: def.label,
      heroEquipmentCount: ctx.activeEquipment.length,
      enabledManualCount: ctx.activeManuals.length,
      matches: buildBotMatches(state, def.id, presets),
    };
  });

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      combatMultiplier: state.combatMultiplier,
      enemyTemplateScale: state.enemyTemplateScale,
      attackerRealm: state.attackerRealm,
      defenderRealm: state.defenderRealm,
    },
    sandboxCurrent: {
      attackerRealm: state.attackerRealm,
      defenderRealm: state.defenderRealm,
      heroPower: currentDuel.heroPower,
      enemyPower: currentDuel.enemyPower,
      duel: currentDuel,
    },
    progression: progressionPoints.map((p) => ({
      realm: p.realm,
      heroPower: Math.round(p.heroPower),
      nextGatePower: p.nextGatePower !== null ? Math.round(p.nextGatePower) : null,
      heroVsNextWin: p.heroVsNextWin,
      heroVsMirrorWin: Math.round(p.heroVsMirrorWin * 1000) / 1000,
      cultivationSpeed: Math.round(p.cultivationSpeed),
    })),
    crossRealmRisks,
    botStrategies,
    realmSweep,
    loadoutAudit,
  };
}

function findBotMatch(
  payload: BalanceReportPayload,
  botId: BotStrategyId,
  predicate: (m: BalanceMatchRow) => boolean,
): BalanceMatchRow | undefined {
  return payload.botStrategies.find((b) => b.id === botId)?.matches.find(predicate);
}

export function applyBalanceRules(payload: BalanceReportPayload): BalanceRuleFlag[] {
  const flags: BalanceRuleFlag[] = [];

  for (const row of payload.realmSweep) {
    if (row.vsNextGate) {
      const win = row.vsNextGate.duel.winChance;
      if (win < NEXT_GATE_LOW) {
        flags.push({
          code: "next_gate_weak",
          severity: "warn",
          evidence: `${row.realm} → ${row.vsNextGate.nextRealm} 破境胜率 ${(win * 100).toFixed(1)}%（目标 ${NEXT_GATE_LOW * 100}–${NEXT_GATE_HIGH * 100}%）`,
        });
      } else if (win > NEXT_GATE_HIGH) {
        flags.push({
          code: "next_gate_trivial",
          severity: "info",
          evidence: `${row.realm} → ${row.vsNextGate.nextRealm} 破境胜率 ${(win * 100).toFixed(1)}% 偏高`,
        });
      }
    }

    if (row.vsBandPreset) {
      const win = row.vsBandPreset.duel.winChance;
      if (win < CHAPTER_BOSS_LOW) {
        flags.push({
          code: "chapter_boss_brutal",
          severity: "warn",
          evidence: `${row.realm} 章节 BOSS（${row.vsBandPreset.presetLabel}）胜率 ${(win * 100).toFixed(1)}%（目标 ${CHAPTER_BOSS_LOW * 100}–45%）`,
        });
      } else if (win > CHAPTER_BOSS_HIGH) {
        flags.push({
          code: "chapter_boss_trivial",
          severity: "info",
          evidence: `${row.realm} 章节 BOSS（${row.vsBandPreset.presetLabel}）胜率 ${(win * 100).toFixed(1)}% 偏高`,
        });
      }
    }
  }

  for (const p of payload.progression) {
    if (p.heroVsMirrorWin > NEXT_GATE_HIGH || p.heroVsMirrorWin < NEXT_GATE_LOW) {
      flags.push({
        code: "mirror_drift",
        severity: "info",
        evidence: `${p.realm} 镜像对战胜率 ${(p.heroVsMirrorWin * 100).toFixed(1)}%`,
      });
    }
  }

  for (const audit of payload.loadoutAudit) {
    for (const issue of audit.issues) {
      flags.push({
        code: issue,
        severity: issue === "library_sparse" || issue === "equip_underfill" ? "warn" : "info",
        evidence: `${audit.realm}：${issue}（${audit.wearSlotFill} 身上栏 / ${audit.manualCount} 功法 / 库 ${audit.libraryItemsInBand} 件）`,
      });
    }
  }

  const cur = payload.sandboxCurrent.duel;
  if (cur.winChance < NEXT_GATE_LOW) {
    flags.push({
      code: "sandbox_weak",
      severity: "warn",
      evidence: `当前沙盘 ${payload.meta.attackerRealm} vs ${payload.meta.defenderRealm} 胜率 ${(cur.winChance * 100).toFixed(1)}%`,
    });
  } else if (cur.winChance > NEXT_GATE_HIGH) {
    flags.push({
      code: "sandbox_trivial",
      severity: "info",
      evidence: `当前沙盘胜率 ${(cur.winChance * 100).toFixed(1)}% 偏高`,
    });
  }

  if (cur.powerGap < 0.5 && cur.winChance > 0.55) {
    flags.push({
      code: "metric_inconsistent",
      severity: "warn",
      evidence: `战力差 ${cur.powerGap.toFixed(2)}x 偏低但胜率 ${(cur.winChance * 100).toFixed(1)}%`,
    });
  } else if (cur.powerGap > 2 && cur.winChance < 0.45) {
    flags.push({
      code: "metric_inconsistent",
      severity: "warn",
      evidence: `战力差 ${cur.powerGap.toFixed(2)}x 偏高但胜率 ${(cur.winChance * 100).toFixed(1)}%`,
    });
  }

  if (payload.crossRealmRisks.length > 0) {
    const worst = payload.crossRealmRisks[0]!;
    flags.push({
      code: "cross_realm_pressure",
      severity: "warn",
      evidence: `${worst.heroRealm} vs ${worst.enemyRealm} 胜率 ${(worst.winChance * 100).toFixed(1)}%（${payload.crossRealmRisks.length} 条风险）`,
    });
  }

  const milestoneCurrent = findBotMatch(
    payload,
    "milestone_standard",
    (m) => m.kind === "current_defender",
  );
  const noManualCurrent = findBotMatch(payload, "no_manuals", (m) => m.kind === "current_defender");
  if (milestoneCurrent && noManualCurrent) {
    const diffPp = (milestoneCurrent.duel.winChance - noManualCurrent.duel.winChance) * 100;
    if (Math.abs(diffPp) > 25) {
      flags.push({
        code: "manual_dependency_high",
        severity: "info",
        evidence: `功法使胜率相差 ${diffPp.toFixed(1)} 百分点（标准养成 vs 无功法）`,
      });
    }
  }

  return flags;
}
