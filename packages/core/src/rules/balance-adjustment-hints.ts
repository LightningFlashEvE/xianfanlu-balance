import { mapRealmNameToBalanceBand } from "../data/balance-realm-bands";
import { data } from "../data/index";
import type {
  BalanceAiEquipmentAdjustment,
  BalanceAiHeroAdjustment,
  BalanceAdjustmentHints,
} from "../schemas/balance-report";
import type { EquipmentInstance } from "../schemas/equipment";
import type { Aptitude, HeroStats } from "../schemas/hero";
import { buildRealmOrderMap, resolveMilestoneEquipmentIds } from "./milestone-loadout";
import type { BalanceReportPayload, BalanceReportState } from "./balance-report";

const NEXT_GATE_LOW = 0.38;
const CHAPTER_BOSS_HIGH = 0.55;
const CHAPTER_BOSS_LOW = 0.25;

function formatCombatBrief(combat: EquipmentInstance["combat"]): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(combat ?? {})) {
    if (typeof value === "number" && value !== 0) {
      parts.push(`${key}=${value}`);
    }
  }
  return parts.length > 0 ? parts.slice(0, 5).join(", ") : "无 combat";
}

function priorityForGateWin(win: number): "P0" | "P1" | "P2" {
  if (win < 0.2) return "P0";
  if (win < NEXT_GATE_LOW) return "P1";
  return "P2";
}

function suggestHeroBump(win: number, realm: string, nextRealm: string): BalanceAiHeroAdjustment {
  const gapPp = Math.round((NEXT_GATE_LOW - win) * 100);
  const scaleReduction = Math.min(12, Math.max(4, Math.round(gapPp * 0.3)));
  return {
    priority: priorityForGateWin(win),
    target: "sandbox-enemy-presets.ts",
    field: "breakthroughGateTemplateScale",
    currentHint: `当前破境守门 enemy scale 偏高，${realm}→${nextRealm} 胜率仅 ${(win * 100).toFixed(1)}%`,
    suggestion: `降低 ${realm} 对应 band 的 breakthroughGateTemplateScale 约 ${scaleReduction}%（如 0.86→${(0.86 * (1 - scaleReduction / 100)).toFixed(2)}），直接削弱守门 enemy；或小幅上调 combatMultiplier 约 ${Math.min(6, Math.round(gapPp * 0.15))}%`,
    affectedRealms: [realm, nextRealm],
    evidence: `${realm}→${nextRealm} 破境胜率 ${(win * 100).toFixed(1)}%，低于 38% 约 ${gapPp}pp`,
  };
}

function suggestEquipmentForRealm(
  state: BalanceReportState,
  realm: string,
  win: number,
  reason: string,
): BalanceAiEquipmentAdjustment[] {
  const realmOrder = buildRealmOrderMap(state.realms);
  const ids = resolveMilestoneEquipmentIds(state.equipment, realm, realmOrder);
  const items = ids
    .map((id) => state.equipment.find((e) => e.instanceId === id))
    .filter((e): e is EquipmentInstance => Boolean(e));
  const band = mapRealmNameToBalanceBand(realm);
  const bumpPct = Math.min(30, Math.max(12, Math.round((NEXT_GATE_LOW - win) * 80)));
  const out: BalanceAiEquipmentAdjustment[] = [];

  for (const item of items.slice(0, 4)) {
    if (Object.keys(item.combat ?? {}).length === 0) continue;
    out.push({
      priority: priorityForGateWin(win),
      itemId: item.instanceId,
      itemName: item.name,
      balanceRealm: item.balanceRealm,
      suggestion: `${formatCombatBrief(item.combat)} 整体上调约 ${bumpPct}%（equipment.library.json combat/growth）`,
      affectedRealms: [realm],
      evidence: `${reason}；里程碑配装 ${item.instanceId}（${band}）`,
    });
  }

  if (out.length === 0) {
    out.push({
      priority: priorityForGateWin(win),
      itemId: "（库扩充）",
      balanceRealm: band,
      suggestion: `为 ${band} 增补 2–3 件带 attackFlat/hpFlat 的凡品~良品装备并纳入里程碑`,
      affectedRealms: [realm],
      evidence: reason,
    });
  }
  return out;
}

export function summarizeEquipmentCatalog(equipment: EquipmentInstance[]) {
  const byBand = new Map<string, { id: string; name: string; quality: string; combatBrief: string }[]>();
  for (const item of equipment) {
    const band = item.balanceRealm || "未知";
    const list = byBand.get(band) ?? [];
    if (list.length < 12) {
      list.push({
        id: item.instanceId,
        name: item.name,
        quality: item.quality,
        combatBrief: formatCombatBrief(item.combat),
      });
    }
    byBand.set(band, list);
  }
  return [...byBand.entries()].map(([bandId, items]) => ({ bandId, items }));
}

export function summarizeHeroBaseline(state: BalanceReportState) {
  const { stats, aptitude, combatMultiplier } = state;
  return {
    combatMultiplier,
    enemyTemplateScale: state.enemyTemplateScale,
    stats: {
      level: stats.level,
      hp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      speed: stats.speed,
      spellPower: stats.spellPower,
      innerPower: stats.innerPower,
    },
    aptitude: {
      rootBone: aptitude.rootBone,
      comprehension: aptitude.comprehension,
      cultivationSpeed: aptitude.cultivationSpeed,
      breakthroughBonus: aptitude.breakthroughBonus,
      opportunityBonus: aptitude.opportunityBonus,
    },
  };
}

export function buildBalanceAdjustmentHints(
  state: BalanceReportState,
  payload: BalanceReportPayload,
): BalanceAdjustmentHints {
  const hero: BalanceAiHeroAdjustment[] = [];
  const equipment: BalanceAiEquipmentAdjustment[] = [];
  const seenHero = new Set<string>();
  const seenEquip = new Set<string>();

  const pushHero = (h: BalanceAiHeroAdjustment) => {
    const key = `${h.affectedRealms?.join(",") ?? h.field}:${h.suggestion.slice(0, 40)}`;
    if (seenHero.has(key)) return;
    seenHero.add(key);
    hero.push(h);
  };

  const pushEquip = (e: BalanceAiEquipmentAdjustment) => {
    const key = `${e.itemId}:${e.suggestion.slice(0, 40)}`;
    if (seenEquip.has(key)) return;
    seenEquip.add(key);
    equipment.push(e);
  };

  for (const row of payload.realmSweep) {
    if (row.vsNextGate) {
      const win = row.vsNextGate.duel.winChance;
      if (win < NEXT_GATE_LOW) {
        pushHero(suggestHeroBump(win, row.realm, row.vsNextGate.nextRealm));
        for (const e of suggestEquipmentForRealm(
          state,
          row.realm,
          win,
          `${row.realm} 破境守门偏弱`,
        )) {
          pushEquip(e);
        }
      }
    }

    if (row.vsBandPreset) {
      const win = row.vsBandPreset.duel.winChance;
      if (win > CHAPTER_BOSS_HIGH) {
        pushEquip({
          priority: win > 0.85 ? "P0" : "P1",
          itemId: "sandbox-enemy-presets",
          itemName: row.vsBandPreset.presetLabel,
          balanceRealm: row.vsBandPreset.presetBandId,
          suggestion: `章节 BOSS 守方 ${row.vsBandPreset.defenderRealm} 偏易：提高 chapterBossTemplateScale（凡俗/江湖/宗师/先天→0.96）或上调该 band 里程碑装备 combat`,
          affectedRealms: [row.realm],
          evidence: `${row.realm} 章节 BOSS 胜率 ${(win * 100).toFixed(1)}% 偏高（目标 25–45%）`,
        });
      } else if (win < CHAPTER_BOSS_LOW) {
        pushEquip({
          priority: "P1",
          itemId: "sandbox-enemy-presets",
          balanceRealm: row.vsBandPreset.presetBandId,
          suggestion: `章节 BOSS 守方 ${row.vsBandPreset.defenderRealm} 偏难：降低 chapterBossTemplateScale（炼气/筑基/金丹→0.86 或再降 0.02）`,
          affectedRealms: [row.realm],
          evidence: `${row.realm} 章节 BOSS 胜率 ${(win * 100).toFixed(1)}% 偏低`,
        });
      }
    }
  }

  for (const audit of payload.loadoutAudit) {
    if (audit.issues.includes("equip_underfill")) {
      pushEquip({
        priority: "P2",
        itemId: "equipment.library.json",
        balanceRealm: mapRealmNameToBalanceBand(audit.realm),
        suggestion: `补 ${audit.realm} 段 2–3 件身上栏装备（武器/防具/饰品），使 wearSlotFill 接近 6+`,
        affectedRealms: [audit.realm],
        evidence: `${audit.realm} equip_underfill（${audit.wearSlotFill} 栏 / 库 ${audit.libraryItemsInBand} 件）`,
      });
    }
    if (audit.issues.includes("manual_dominated")) {
      pushHero({
        priority: "P1",
        target: "packages/core/src/data/meta.json",
        field: "manualBalance.proficiencyEffectWeight",
        currentHint: `当前约 ${data.meta.manualBalance.proficiencyEffectWeight ?? 0.19}`,
        suggestion: `炼气后期及以后可再下调 proficiencyEffectWeight 10–15%，或同步抬升 ${audit.realm} 段里程碑装备 combat 15–20%`,
        affectedRealms: [audit.realm],
        evidence: `${audit.realm} manual_dominated，功法占比 ${(audit.manualPowerShare * 100).toFixed(0)}%`,
      });
      for (const e of suggestEquipmentForRealm(
        state,
        audit.realm,
        0.35,
        `${audit.realm} 功法占比过高，装备端需补强`,
      )) {
        pushEquip(e);
      }
    }
    if (audit.issues.includes("library_sparse")) {
      pushEquip({
        priority: "P2",
        itemId: "equipment.library.json",
        balanceRealm: mapRealmNameToBalanceBand(audit.realm),
        suggestion: `扩充该大境界段装备库至至少 8 件可用里程碑条目`,
        affectedRealms: [audit.realm],
        evidence: `${audit.realm} library_sparse（库 ${audit.libraryItemsInBand} 件）`,
      });
    }
  }

  if (payload.sandboxCurrent.duel.winChance > 0.85) {
    pushHero({
      priority: "P2",
      target: "HeroConfig",
      field: "enemyTemplateScale",
      currentHint: String(state.enemyTemplateScale),
      suggestion: `沙盘守方 scale 上调至 0.92–1.0，或换更强 defenderRealm，使校验胜率约 75–85%`,
      affectedRealms: [state.attackerRealm],
      evidence: `沙盘当前胜率 ${(payload.sandboxCurrent.duel.winChance * 100).toFixed(1)}%`,
    });
  }

  return {
    hero: hero.slice(0, 12),
    equipment: equipment.slice(0, 16),
  };
}
