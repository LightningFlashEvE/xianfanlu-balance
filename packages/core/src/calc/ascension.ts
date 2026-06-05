/**
 * 飞升继承系统（Ascension Inheritance）
 *
 * 玩家飞升仙界时，凡界装备有三条出路：
 * ① 本命共炼 → 红尘仙兵（可成长仙器，≤3件）
 * ② 本源继承 → 器魂精魄（消耗品，嵌入仙界装备）
 * ③ 灵识转生 → 器灵（专属被动技能）
 */

import type { CombatEffects, EquipmentDef } from "..";
import type { ItemQualityId } from "../data/item-quality";

// ==================== 类型定义 ====================

/** 飞升继承清单：飞升前玩家选择的装备分配方案 */
export type AscensionPlan = {
  /** 本命共炼装备 ID（最多 3 件） */
  lifeBoundIds: string[];
  /** 本源继承分解装备 ID */
  essenceDecomposeIds: string[];
  /** 灵识转生装备 ID */
  spiritRebirthIds: string[];
};

/** 红尘仙兵觉醒阶段 */
export type ImmortalWeaponStage = "sealed" | "awakening" | "resonance" | "unity";

/** 红尘仙兵继承系数（按阶段） */
export const IMMORTAL_WEAPON_INHERITANCE: Record<ImmortalWeaponStage, number> = {
  sealed: 0.15,
  awakening: 0.35,
  resonance: 0.60,
  unity: 0.85,
};

/** 红尘仙兵 */
export type RedDustImmortalWeapon = {
  /** 凡界原始装备 ID */
  baseId: string;
  /** 凡界原始装备名 */
  baseName: string;
  /** 当前觉醒阶段 */
  stage: ImmortalWeaponStage;
  /** 继承的战斗属性（已乘以继承系数） */
  inheritedCombat: CombatEffects;
  /** 已解锁的技能树节点 */
  unlockedSkills: ImmortalWeaponSkill[];
};

/** 红尘仙兵技能树节点 */
export type ImmortalWeaponSkill = {
  /** 技能名 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 解锁阶段 */
  unlockStage: ImmortalWeaponStage;
  /** 技能类型 */
  type: "passive" | "active" | "ultimate";
  /** 技能效果数值 */
  value: number;
};

/** 器魂精魄 */
export type ArtifactSoulEssence = {
  /** 来源装备 ID */
  sourceId: string;
  /** 来源装备名 */
  sourceName: string;
  /** 来源品质 */
  sourceQuality: ItemQualityId;
  /** 继承的效果 */
  effect: CombatEffects;
  /** 来源装备类型（剑/刀/甲等） */
  slotType: string;
};

/** 器灵被动技能 */
export type SpiritPassiveSkill = {
  /** 技能名 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 效果数值（随战斗次数变化） */
  baseValue: number;
  /** 效果类型标识 */
  effectKey: string;
};

/** 器灵 */
export type ArtifactSpirit = {
  /** 来源装备 ID */
  sourceId: string;
  /** 来源装备名 */
  sourceName: string;
  /** 器灵名字 */
  spiritName: string;
  /** 参与战斗次数 */
  battleCount: number;
  /** 专属被动技能 */
  passiveSkill: SpiritPassiveSkill;
  /** 与嵌入仙器的契合度（0~1） */
  affinity: number;
};

// ==================== 条件判断 ====================

/** 是否可作为本命共炼（品质 ≥ 良品） */
export function canBeLifeBound(equip: EquipmentDef): boolean {
  const qualityOrder: Record<string, number> = {
    "凡品": 0,
    "良品": 1,
    "珍品": 2,
    "绝品": 3,
  };
  return (qualityOrder[equip.quality] ?? 0) >= 1;
}

/** 是否可分解为器魂精魄（有 combat 属性） */
export function canDecomposeToEssence(equip: EquipmentDef): boolean {
  const combat = equip.combat ?? {};
  return Object.keys(combat).length > 0;
}

/** 是否可产生器灵（品质 = 绝品 或有足够的战斗记录） */
export function canSpawnSpirit(equip: EquipmentDef, battleCount: number = 0): boolean {
  if (equip.quality === "绝品") return true;
  if (battleCount >= 30) return true;
  // 炼化过 ≥ 2 次
  if ((equip.upgradeTier ?? 0) >= 2) return true;
  return false;
}

/** 验证飞升继承清单的合法性 */
export function validateAscensionPlan(
  plan: AscensionPlan,
  allEquipment: EquipmentDef[],
  battleCounts: Record<string, number> = {},
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const equipMap = new Map(allEquipment.map((e) => [e.id, e]));

  // ① 本命共炼 ≤ 3 件
  if (plan.lifeBoundIds.length > 3) {
    errors.push(`本命共炼最多 3 件，当前 ${plan.lifeBoundIds.length} 件`);
  }
  for (const id of plan.lifeBoundIds) {
    const eq = equipMap.get(id);
    if (!eq) {
      errors.push(`装备 ${id} 不存在`);
      continue;
    }
    if (!canBeLifeBound(eq)) {
      errors.push(`${eq.name}(${id}) 品质为${eq.quality}，不可作为本命共炼（需 ≥ 良品）`);
    }
  }

  // ② 本命共炼的装备不能再走 ②③
  const lifeBoundSet = new Set(plan.lifeBoundIds);
  for (const id of plan.essenceDecomposeIds) {
    if (lifeBoundSet.has(id)) {
      errors.push(`装备 ${id} 已选为本命共炼，不可分解为精魄`);
    }
    const eq = equipMap.get(id);
    if (eq && !canDecomposeToEssence(eq)) {
      errors.push(`${eq.name}(${id}) 无战斗属性，不可分解为精魄`);
    }
  }
  for (const id of plan.spiritRebirthIds) {
    if (lifeBoundSet.has(id)) {
      errors.push(`装备 ${id} 已选为本命共炼，不可转生为器灵`);
    }
    const eq = equipMap.get(id);
    if (eq && !canSpawnSpirit(eq, battleCounts[id] ?? 0)) {
      errors.push(`${eq.name}(${id}) 不满足器灵产生条件`);
    }
  }

  // ③ 本源继承和灵识转生互斥（同一装备不能同时走两条路）
  const essenceSet = new Set(plan.essenceDecomposeIds);
  for (const id of plan.spiritRebirthIds) {
    if (essenceSet.has(id)) {
      errors.push(`装备 ${id} 不能同时走本源继承和灵识转生`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ==================== 红尘仙兵 ====================

/** 红尘仙兵技能树模板（按装备类型） */
const SKILL_TEMPLATES: Record<
  string,
  [ImmortalWeaponSkill, ImmortalWeaponSkill, ImmortalWeaponSkill]
> = {
  剑: [
    { name: "剑心通明", description: "剑类暴击率提升", unlockStage: "awakening", type: "passive", value: 3 },
    { name: "一剑破万法", description: "蓄力攻击伤害倍增", unlockStage: "resonance", type: "active", value: 2.5 },
    { name: "万剑归宗", description: "濒死时全属性暴涨", unlockStage: "unity", type: "ultimate", value: 0.25 },
  ],
  刀: [
    { name: "刀意纵横", description: "刀类攻击概率追加一击", unlockStage: "awakening", type: "passive", value: 0.12 },
    { name: "血刃狂澜", description: "攻击时吸取生命", unlockStage: "resonance", type: "active", value: 0.08 },
    { name: "刀山血海", description: "连续攻击伤害递增", unlockStage: "unity", type: "ultimate", value: 0.35 },
  ],
  枪: [
    { name: "破甲之忆", description: "无视部分敌方防御", unlockStage: "awakening", type: "passive", value: 0.12 },
    { name: "一枪穿云", description: "贯穿伤害无视护盾", unlockStage: "resonance", type: "active", value: 0.5 },
    { name: "龙胆不灭", description: "濒死时攻防暴涨", unlockStage: "unity", type: "ultimate", value: 0.25 },
  ],
  矛: [
    { name: "破甲之忆", description: "无视部分敌方防御", unlockStage: "awakening", type: "passive", value: 0.12 },
    { name: "矛意贯通", description: "蓄力一击伤害倍增", unlockStage: "resonance", type: "active", value: 2.5 },
    { name: "红尘不灭", description: "濒死时全属性暴涨", unlockStage: "unity", type: "ultimate", value: 0.25 },
  ],
  棍: [
    { name: "横扫千军", description: "棍类攻击附加防御", unlockStage: "awakening", type: "passive", value: 0.08 },
    { name: "棍扫八荒", description: "范围伤害提升", unlockStage: "resonance", type: "active", value: 1.8 },
    { name: "不动明王", description: "受击时概率反弹伤害", unlockStage: "unity", type: "ultimate", value: 0.2 },
  ],
  拳套: [
    { name: "拳拳到肉", description: "暴击伤害提升", unlockStage: "awakening", type: "passive", value: 0.2 },
    { name: "连珠快拳", description: "概率追加攻击", unlockStage: "resonance", type: "active", value: 0.15 },
    { name: "万拳归一", description: "连续攻击后必暴击", unlockStage: "unity", type: "ultimate", value: 1.0 },
  ],
  暗器: [
    { name: "暗影追踪", description: "暗器命中率提升", unlockStage: "awakening", type: "passive", value: 0.05 },
    { name: "暴雨梨花", description: "多段暗器齐发", unlockStage: "resonance", type: "active", value: 3 },
    { name: "无声夺命", description: "首击必定暴击", unlockStage: "unity", type: "ultimate", value: 1.0 },
  ],
  弓箭: [
    { name: "百步穿杨", description: "远程命中与暴击提升", unlockStage: "awakening", type: "passive", value: 0.04 },
    { name: "追风箭雨", description: "连续射击伤害递增", unlockStage: "resonance", type: "active", value: 1.6 },
    { name: "一箭封喉", description: "对BOSS伤害大幅提升", unlockStage: "unity", type: "ultimate", value: 0.5 },
  ],
  衣甲: [
    { name: "铁壁之躯", description: "受击减伤提升", unlockStage: "awakening", type: "passive", value: 0.08 },
    { name: "荆棘反甲", description: "受击时反弹伤害", unlockStage: "resonance", type: "active", value: 0.15 },
    { name: "不死金身", description: "致命伤害概率存活", unlockStage: "unity", type: "ultimate", value: 0.1 },
  ],
  靴子: [
    { name: "疾风步", description: "闪避率与先手提升", unlockStage: "awakening", type: "passive", value: 0.04 },
    { name: "踏云无痕", description: "闪避后必定先手", unlockStage: "resonance", type: "active", value: 1.0 },
    { name: "缩地成寸", description: "概率闪避所有伤害", unlockStage: "unity", type: "ultimate", value: 0.15 },
  ],
  帽子: [
    { name: "灵台清明", description: "精神防御提升", unlockStage: "awakening", type: "passive", value: 0.1 },
    { name: "神识护体", description: "法术减伤提升", unlockStage: "resonance", type: "active", value: 0.12 },
    { name: "天人合一", description: "灵力自动回复", unlockStage: "unity", type: "ultimate", value: 0.05 },
  ],
  护符: [
    { name: "灵气护体", description: "灵盾值提升", unlockStage: "awakening", type: "passive", value: 0.1 },
    { name: "金钟罩", description: "受击时概率触发护盾", unlockStage: "resonance", type: "active", value: 0.2 },
    { name: "万法不侵", description: "免疫一次致命法术", unlockStage: "unity", type: "ultimate", value: 1.0 },
  ],
  法宝: [
    { name: "器灵共鸣", description: "法术威力提升", unlockStage: "awakening", type: "passive", value: 0.08 },
    { name: "灵力潮汐", description: "每回合恢复灵力", unlockStage: "resonance", type: "active", value: 0.05 },
    { name: "万宝归一", description: "法术伤害无视法抗", unlockStage: "unity", type: "ultimate", value: 0.3 },
  ],
  阵盘: [
    { name: "阵法精通", description: "阵盘效果提升", unlockStage: "awakening", type: "passive", value: 0.1 },
    { name: "困仙阵", description: "概率限制敌方行动", unlockStage: "resonance", type: "active", value: 0.25 },
    { name: "天地大阵", description: "阵法效果翻倍", unlockStage: "unity", type: "ultimate", value: 2.0 },
  ],
  飞剑法器: [
    { name: "御剑之术", description: "飞剑命中率提升", unlockStage: "awakening", type: "passive", value: 0.05 },
    { name: "万剑齐发", description: "概率多剑齐射", unlockStage: "resonance", type: "active", value: 3 },
    { name: "剑阵合一", description: "飞剑伤害无视距离", unlockStage: "unity", type: "ultimate", value: 0.4 },
  ],
  玉佩: [
    { name: "灵玉庇佑", description: "全属性小幅提升", unlockStage: "awakening", type: "passive", value: 0.03 },
    { name: "玉碎护主", description: "致命时消耗玉佩存活", unlockStage: "resonance", type: "active", value: 1.0 },
    { name: "天地灵韵", description: "修炼速度提升", unlockStage: "unity", type: "ultimate", value: 0.15 },
  ],
  戒指: [
    { name: "灵犀一指", description: "攻击附加灵力伤害", unlockStage: "awakening", type: "passive", value: 0.05 },
    { name: "双生共鸣", description: "与另一戒指效果叠加", unlockStage: "resonance", type: "active", value: 0.5 },
    { name: "乾坤戒灵", description: "戒指效果翻倍", unlockStage: "unity", type: "ultimate", value: 2.0 },
  ],
  攻击符: [
    { name: "符力增幅", description: "符箓伤害提升", unlockStage: "awakening", type: "passive", value: 0.15 },
    { name: "连环符阵", description: "符箓触发连锁", unlockStage: "resonance", type: "active", value: 2 },
    { name: "天罚神符", description: "符箓伤害无视抗性", unlockStage: "unity", type: "ultimate", value: 0.3 },
  ],
  防御符: [
    { name: "金刚不坏", description: "防御符效果提升", unlockStage: "awakening", type: "passive", value: 0.12 },
    { name: "万法归元", description: "受法伤时回复灵力", unlockStage: "resonance", type: "active", value: 0.08 },
    { name: "不灭符印", description: "防御符永久生效", unlockStage: "unity", type: "ultimate", value: 1.0 },
  ],
  辅助符: [
    { name: "灵符妙用", description: "辅助效果提升", unlockStage: "awakening", type: "passive", value: 0.1 },
    { name: "符灵相助", description: "辅助符触发额外效果", unlockStage: "resonance", type: "active", value: 0.15 },
    { name: "天人符契", description: "所有符箓效果翻倍", unlockStage: "unity", type: "ultimate", value: 2.0 },
  ],
  战斗傀儡: [
    { name: "傀儡精通", description: "傀儡战力提升", unlockStage: "awakening", type: "passive", value: 0.12 },
    { name: "双傀合璧", description: "可同时操控两具傀儡", unlockStage: "resonance", type: "active", value: 1.0 },
    { name: "傀儡大军", description: "召唤额外傀儡助战", unlockStage: "unity", type: "ultimate", value: 2 },
  ],
  储物袋: [
    { name: "纳物神通", description: "储物空间提升", unlockStage: "awakening", type: "passive", value: 0.15 },
    { name: "乾坤挪移", description: "战斗中取出道具加速", unlockStage: "resonance", type: "active", value: 0.5 },
    { name: "袖里乾坤", description: "储物无限制", unlockStage: "unity", type: "ultimate", value: 1.0 },
  ],
};

/** 获取装备类型的技能树模板 */
function getSkillTemplate(category: string): [ImmortalWeaponSkill, ImmortalWeaponSkill, ImmortalWeaponSkill] | null {
  return SKILL_TEMPLATES[category] ?? null;
}

/** 计算封印/解封后的战斗属性 */
export function calculateSealedStats(
  combat: CombatEffects,
  stage: ImmortalWeaponStage,
): CombatEffects {
  const ratio = IMMORTAL_WEAPON_INHERITANCE[stage];
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(combat)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      // 百分比属性直接乘，flat 属性乘后取整
      if (key.endsWith("Percent")) {
        result[key] = Math.round(value * ratio * 1000) / 1000;
      } else {
        result[key] = Math.max(1, Math.round(value * ratio));
      }
    }
  }
  return result as CombatEffects;
}

/** 生成红尘仙兵 */
export function createImmortalWeapon(
  equip: EquipmentDef,
  stage: ImmortalWeaponStage = "sealed",
): RedDustImmortalWeapon {
  const template = getSkillTemplate(equip.category);
  const unlockedSkills: ImmortalWeaponSkill[] = [];

  if (template) {
    const stageOrder: ImmortalWeaponStage[] = ["sealed", "awakening", "resonance", "unity"];
    const currentIdx = stageOrder.indexOf(stage);
    for (const skill of template) {
      if (stageOrder.indexOf(skill.unlockStage) <= currentIdx) {
        unlockedSkills.push(skill);
      }
    }
  }

  return {
    baseId: equip.id,
    baseName: equip.name,
    stage,
    inheritedCombat: calculateSealedStats(equip.combat ?? {}, stage),
    unlockedSkills,
  };
}

/** 红尘仙兵进阶到下一阶段 */
export function advanceImmortalWeapon(weapon: RedDustImmortalWeapon): RedDustImmortalWeapon {
  const stageOrder: ImmortalWeaponStage[] = ["sealed", "awakening", "resonance", "unity"];
  const currentIdx = stageOrder.indexOf(weapon.stage);
  if (currentIdx >= stageOrder.length - 1) return weapon; // 已满阶
  return { ...weapon, stage: stageOrder[currentIdx + 1]! };
}

// ==================== 器魂精魄 ====================

/** 器魂精魄继承系数（按品质） */
const ESSENCE_INHERITANCE_RATIO: Record<string, number> = {
  "凡品": 0.12,
  "良品": 0.15,
  "珍品": 0.18,
  "绝品": 0.22,
};

/** 计算分解后的器魂精魄 */
export function createArtifactSoulEssence(equip: EquipmentDef): ArtifactSoulEssence | null {
  if (!canDecomposeToEssence(equip)) return null;

  const combat = equip.combat ?? {};
  const ratio = ESSENCE_INHERITANCE_RATIO[equip.quality] ?? 0.12;
  const effect: Record<string, number> = {};

  for (const [key, value] of Object.entries(combat)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      if (key.endsWith("Percent")) {
        effect[key] = Math.round(value * ratio * 1000) / 1000;
      } else {
        effect[key] = Math.max(1, Math.round(value * ratio));
      }
    }
  }

  return {
    sourceId: equip.id,
    sourceName: equip.name,
    sourceQuality: equip.quality,
    effect: effect as CombatEffects,
    slotType: equip.category,
  };
}

// ==================== 器灵 ====================

/** 器灵被动技能表（按装备类型，固定） */
const SPIRIT_PASSIVE_TABLE: Record<
  string,
  { name: string; description: string; effectKey: string; baseValue: number }
> = {
  剑: { name: "剑灵·锐", description: "装备剑类武器时暴击率提升", effectKey: "critRateFlat", baseValue: 2 },
  刀: { name: "刀灵·猛", description: "装备刀类武器时攻击提升", effectKey: "attackPercent", baseValue: 0.03 },
  枪: { name: "枪灵·穿", description: "装备枪类时穿透防御", effectKey: "attackFlat", baseValue: 5 },
  矛: { name: "矛灵·破", description: "装备矛类时无视防御", effectKey: "attackFlat", baseValue: 5 },
  棍: { name: "棍灵·稳", description: "装备棍类时防御提升", effectKey: "defenseFlat", baseValue: 4 },
  拳套: { name: "拳灵·疾", description: "装备拳套时暴击伤害提升", effectKey: "critDamageFlat", baseValue: 15 },
  暗器: { name: "暗灵·隐", description: "装备暗器时命中率提升", effectKey: "hitRateFlat", baseValue: 3 },
  弓箭: { name: "弓灵·远", description: "装备弓类时先手提升", effectKey: "speedFlat", baseValue: 3 },
  短兵: { name: "兵灵·锐", description: "装备短兵时攻击提升", effectKey: "attackFlat", baseValue: 4 },
  长兵: { name: "兵灵·长", description: "装备长兵时攻击范围提升", effectKey: "attackFlat", baseValue: 4 },
  远程武器: { name: "远灵·准", description: "装备远程武器时命中提升", effectKey: "hitRateFlat", baseValue: 3 },
  衣甲: { name: "甲灵·坚", description: "装备衣甲时减伤提升", effectKey: "defensePercent", baseValue: 0.04 },
  靴子: { name: "靴灵·捷", description: "装备靴子时闪避提升", effectKey: "dodgeRateFlat", baseValue: 2 },
  帽子: { name: "冠灵·慧", description: "装备帽子时精神防御提升", effectKey: "spiritShieldFlat", baseValue: 8 },
  护符: { name: "符灵·护", description: "装备护符时灵盾提升", effectKey: "spiritShieldPercent", baseValue: 0.05 },
  法宝: { name: "宝灵·威", description: "装备法宝时法术威力提升", effectKey: "spellPowerPercent", baseValue: 0.05 },
  阵盘: { name: "阵灵·玄", description: "装备阵盘时法术提升", effectKey: "spellPowerFlat", baseValue: 6 },
  飞剑法器: { name: "剑灵·御", description: "装备飞剑时命中提升", effectKey: "hitRateFlat", baseValue: 3 },
  玉佩: { name: "玉灵·润", description: "装备玉佩时全属性小幅提升", effectKey: "hpPercent", baseValue: 0.02 },
  戒指: { name: "戒灵·锐", description: "装备戒指时攻击提升", effectKey: "attackFlat", baseValue: 3 },
  饰品: { name: "饰灵·灵", description: "装备饰品时灵力提升", effectKey: "spiritualPowerFlat", baseValue: 5 },
  攻击符: { name: "符灵·爆", description: "使用攻击符时伤害提升", effectKey: "spellPowerFlat", baseValue: 5 },
  防御符: { name: "符灵·壁", description: "使用防御符时防御提升", effectKey: "defenseFlat", baseValue: 5 },
  辅助符: { name: "符灵·辅", description: "使用辅助符时效果提升", effectKey: "innerPowerFlat", baseValue: 5 },
  战斗傀儡: { name: "傀灵·忠", description: "傀儡战力提升", effectKey: "attackFlat", baseValue: 4 },
  储物袋: { name: "袋灵·容", description: "储物空间提升", effectKey: "hpFlat", baseValue: 10 },
  机缘物: { name: "缘灵·运", description: "机缘概率提升", effectKey: "hpPercent", baseValue: 0.03 },
};

/** 战斗次数决定技能强度倍率 */
function getBattleCountMultiplier(battleCount: number): number {
  if (battleCount >= 100) return 1.6;
  if (battleCount >= 50) return 1.3;
  return 1.0;
}

/** 生成器灵名字（基于装备名） */
function generateSpiritName(equipName: string): string {
  // 简单规则：取装备名前两个字 + 灵
  const prefix = equipName.slice(0, 2);
  return `${prefix}灵`;
}

/** 计算器灵的契合度 */
export function calculateSpiritAffinity(
  spiritSlotType: string,
  targetCategory: string,
): number {
  if (spiritSlotType === targetCategory) return 1.0; // 完全匹配
  // 同大类匹配（武器类互相 80%）
  const weaponTypes = ["剑", "刀", "枪", "矛", "棍", "拳套", "暗器", "弓箭", "短兵", "长兵", "远程武器"];
  const armorTypes = ["衣甲", "靴子", "帽子"];
  const artifactTypes = ["护符", "法宝", "阵盘", "飞剑法器"];
  const accessoryTypes = ["玉佩", "戒指", "饰品"];

  if (weaponTypes.includes(spiritSlotType) && weaponTypes.includes(targetCategory)) return 0.8;
  if (armorTypes.includes(spiritSlotType) && armorTypes.includes(targetCategory)) return 0.8;
  if (artifactTypes.includes(spiritSlotType) && artifactTypes.includes(targetCategory)) return 0.8;
  if (accessoryTypes.includes(spiritSlotType) && accessoryTypes.includes(targetCategory)) return 0.8;

  return 0.6; // 不匹配基础契合度
}

/** 生成器灵 */
export function createArtifactSpirit(
  equip: EquipmentDef,
  battleCount: number = 0,
): ArtifactSpirit | null {
  if (!canSpawnSpirit(equip, battleCount)) return null;

  const template = SPIRIT_PASSIVE_TABLE[equip.category];
  if (!template) {
    // 未知类型，用通用器灵
    return {
      sourceId: equip.id,
      sourceName: equip.name,
      spiritName: generateSpiritName(equip.name),
      battleCount,
      passiveSkill: {
        name: "器灵·通用",
        description: "嵌入装备时小幅提升全属性",
        baseValue: 0.02,
        effectKey: "hpPercent",
      },
      affinity: 0.6,
    };
  }

  const multiplier = getBattleCountMultiplier(battleCount);
  const adjustedValue = template.effectKey.endsWith("Percent")
    ? Math.round(template.baseValue * multiplier * 1000) / 1000
    : Math.round(template.baseValue * multiplier);

  return {
    sourceId: equip.id,
    sourceName: equip.name,
    spiritName: equip.ascension?.spiritName ?? generateSpiritName(equip.name),
    battleCount,
    passiveSkill: {
      name: template.name,
      description: template.description,
      baseValue: adjustedValue,
      effectKey: template.effectKey,
    },
    affinity: 0.6, // 默认契合度，嵌入时根据目标装备调整
  };
}

// ==================== 飞升继承执行 ====================

/** 执行飞升继承，生成所有继承物 */
export function executeAscension(
  plan: AscensionPlan,
  allEquipment: EquipmentDef[],
  battleCounts: Record<string, number> = {},
): {
  immortalWeapons: RedDustImmortalWeapon[];
  soulEssences: ArtifactSoulEssence[];
  spirits: ArtifactSpirit[];
  errors: string[];
} {
  const equipMap = new Map(allEquipment.map((e) => [e.id, e]));
  const validation = validateAscensionPlan(plan, allEquipment, battleCounts);

  if (!validation.valid) {
    return { immortalWeapons: [], soulEssences: [], spirits: [], errors: validation.errors };
  }

  const immortalWeapons: RedDustImmortalWeapon[] = [];
  const soulEssences: ArtifactSoulEssence[] = [];
  const spirits: ArtifactSpirit[] = [];

  for (const id of plan.lifeBoundIds) {
    const eq = equipMap.get(id);
    if (eq) immortalWeapons.push(createImmortalWeapon(eq, "sealed"));
  }

  for (const id of plan.essenceDecomposeIds) {
    const eq = equipMap.get(id);
    if (eq) {
      const essence = createArtifactSoulEssence(eq);
      if (essence) soulEssences.push(essence);
    }
  }

  for (const id of plan.spiritRebirthIds) {
    const eq = equipMap.get(id);
    if (eq) {
      const spirit = createArtifactSpirit(eq, battleCounts[id] ?? 0);
      if (spirit) spirits.push(spirit);
    }
  }

  return { immortalWeapons, soulEssences, spirits, errors: [] };
}
