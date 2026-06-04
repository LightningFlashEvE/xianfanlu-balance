export const statFields = [
  { key: "level", label: "等级", step: 1, min: 1 },
  { key: "hp", label: "生命 HP", step: 1, min: 1 },
  { key: "stamina", label: "体力 Stamina", step: 1, min: 0 },
  { key: "attack", label: "攻击 Attack", step: 1, min: 0 },
  { key: "defense", label: "防御 Defense", step: 1, min: 0 },
  { key: "speed", label: "速度 Speed", step: 1, min: 0 },
  { key: "hitRate", label: "命中 HitRate %", step: 1, min: 0, max: 100 },
  { key: "dodgeRate", label: "闪避 DodgeRate %", step: 1, min: 0, max: 95 },
  { key: "critRate", label: "暴击 CritRate %", step: 1, min: 0, max: 100 },
  { key: "critDamage", label: "暴击伤害 CritDamage %", step: 5, min: 100 },
  { key: "attackInterval", label: "攻击间隔 秒", step: 0.1, min: 0.2 },
  { key: "innerPower", label: "内力 InnerPower", step: 1, min: 0 },
  { key: "spiritualPower", label: "灵力 SpiritualPower", step: 1, min: 0 },
  { key: "spiritShield", label: "灵力护盾 SpiritShield", step: 1, min: 0 },
  { key: "divineSense", label: "神识 DivineSense", step: 1, min: 0 },
  { key: "spellPower", label: "法术强度 SpellPower", step: 1, min: 0 },
] as const;

export { fiveElements, spiritualRootCountOptions, formatSpiritualRootLabel } from "./spiritual-root";

export const aptitudeFields = [
  { key: "rootBone", label: "根骨 / 10", type: "number" as const, step: 1, min: 1, max: 10 },
  { key: "comprehension", label: "悟性 / 10", type: "number" as const, step: 1, min: 1, max: 10 },
  { key: "luck", label: "气运 / 10", type: "number" as const, step: 1, min: 1, max: 10 },
  { key: "temperament", label: "心性 / 10", type: "number" as const, step: 1, min: 1, max: 10 },
  { key: "cultivationSpeed", label: "修炼速度 %", type: "number" as const, step: 5, min: 10 },
  { key: "breakthroughBonus", label: "突破成功率修正 %", type: "number" as const, step: 1, min: -100 },
  { key: "opportunityBonus", label: "机缘触发率修正 %", type: "number" as const, step: 1, min: -100 },
];
