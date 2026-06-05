import type { BalanceRealmBandId } from "./balance-realm-bands";

/** 沙盘敌方快速模板：band 基准守方 + 章节 BOSS 专用 scale */
export type SandboxEnemyPresetDef = {
  bandId: BalanceRealmBandId;
  label: string;
  defenderRealm: string;
  /** 沙盘一键模板默认 scale */
  enemyTemplateScale: number;
  /** 破境守门（realmSweep.vsNextGate / 进度轴红线）专用 scale */
  breakthroughGateTemplateScale: number;
  /** 破境守门额外携带的背包型外物数量上限 */
  breakthroughGateBagItemLimit: number;
  /** 平衡报告章节 BOSS（realmSweep.vsBandPreset）专用 scale */
  chapterBossTemplateScale: number;
  summary: string;
};

export const sandboxEnemyPresetDefs: SandboxEnemyPresetDef[] = [
  {
    bandId: "凡俗期",
    label: "凡俗期",
    defenderRealm: "普通凡人",
    enemyTemplateScale: 0.92,
    breakthroughGateTemplateScale: 0.72,
    breakthroughGateBagItemLimit: 1,
    chapterBossTemplateScale: 0.96,
    summary: "境界：普通凡人 · 沙盘模板 · 破境守门独立模板 · 章节 BOSS 动态上抬守方",
  },
  {
    bandId: "江湖期",
    label: "江湖期",
    defenderRealm: "江湖二流",
    enemyTemplateScale: 0.92,
    breakthroughGateTemplateScale: 0.90,
    breakthroughGateBagItemLimit: 1,
    chapterBossTemplateScale: 0.96,
    summary: "境界：江湖二流（模板基准）· 章节 BOSS 按主角境界上抬一档",
  },
  {
    bandId: "宗师期",
    label: "宗师期",
    defenderRealm: "武道宗师",
    enemyTemplateScale: 0.92,
    breakthroughGateTemplateScale: 0.90,
    breakthroughGateBagItemLimit: 2,
    chapterBossTemplateScale: 0.96,
    summary: "境界：武道宗师 · 章节 BOSS 动态守方",
  },
  {
    bandId: "先天期",
    label: "先天期",
    defenderRealm: "先天武者",
    enemyTemplateScale: 0.92,
    breakthroughGateTemplateScale: 0.90,
    breakthroughGateBagItemLimit: 2,
    chapterBossTemplateScale: 0.96,
    summary: "境界：先天武者 · 章节 BOSS 动态守方",
  },
  {
    bandId: "炼气期",
    label: "炼气期",
    defenderRealm: "炼气中期",
    enemyTemplateScale: 0.92,
    breakthroughGateTemplateScale: 0.90,
    breakthroughGateBagItemLimit: 2,
    chapterBossTemplateScale: 0.96,
    summary: "境界：炼气中期（模板基准）· 章节 BOSS scale 0.96",
  },
  {
    bandId: "筑基期",
    label: "筑基期",
    defenderRealm: "筑基中期",
    enemyTemplateScale: 0.92,
    breakthroughGateTemplateScale: 0.72,
    breakthroughGateBagItemLimit: 2,
    chapterBossTemplateScale: 0.96,
    summary: "境界：筑基中期（模板基准）· 章节 BOSS scale 0.96",
  },
  {
    bandId: "金丹期",
    label: "金丹期",
    defenderRealm: "金丹中期",
    enemyTemplateScale: 0.92,
    breakthroughGateTemplateScale: 0.80,
    breakthroughGateBagItemLimit: 2,
    chapterBossTemplateScale: 0.96,
    summary: "境界：金丹中期（模板基准）· 章节 BOSS scale 0.96",
  },
];

export function getChapterBossTemplateScale(bandId: BalanceRealmBandId): number {
  return sandboxEnemyPresetDefs.find((d) => d.bandId === bandId)?.chapterBossTemplateScale ?? 0.92;
}

export function getBreakthroughGateTemplateScale(bandId: BalanceRealmBandId): number {
  return sandboxEnemyPresetDefs.find((d) => d.bandId === bandId)?.breakthroughGateTemplateScale ?? 0.88;
}

export function getBreakthroughGateBagItemLimit(bandId: BalanceRealmBandId): number {
  return sandboxEnemyPresetDefs.find((d) => d.bandId === bandId)?.breakthroughGateBagItemLimit ?? 1;
}
