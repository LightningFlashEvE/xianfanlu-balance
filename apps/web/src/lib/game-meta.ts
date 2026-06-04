import {
  equipmentSlotOptions,
  equipmentTaxonomyGroups,
  getEquipmentCategoryOptions,
  itemQualityTiers,
} from "@xianfanlu/core";

export { equipmentSlotOptions, equipmentTaxonomyGroups, itemQualityTiers };

export const itemQualityOptions = itemQualityTiers.map((q) => q.id);

export function getCategoryOptionsForSlot(slot: string) {
  return getEquipmentCategoryOptions(slot);
}

export const manualRankOptions = ["凡阶", "江湖", "江湖 / 先天", "先天", "炼气", "筑基", "金丹", "元婴", "自定义"];
export const manualTypeOptions = [
  "外功",
  "内功",
  "轻功",
  "剑法",
  "刀法",
  "拳法",
  "棍法",
  "横练",
  "暗器",
  "医毒",
  "机关术",
  "过渡功法",
  "修仙功法",
  "法术",
  "神通",
  "遁法",
  "炼体功法",
  "神识功法",
  "炼丹术",
  "炼器术",
  "阵法术",
  "符箓术",
  "魔功",
  "邪功",
  "功法",
];

export const proficiencyOptions = ["初窥门径", "略有小成", "融会贯通", "炉火纯青", "登峰造极"];

export type EffectOption = {
  key: string;
  label: string;
  unit: string;
  step: number;
  inputType: "raw" | "decimalPercent" | "multiplierPercent";
  defaultValue: number;
};

export const combatEffectOptions: EffectOption[] = [
  { key: "hpFlat", label: "生命", unit: "", step: 1, inputType: "raw", defaultValue: 10 },
  { key: "hpPercent", label: "生命加成", unit: "%", step: 1, inputType: "decimalPercent", defaultValue: 5 },
  { key: "attackFlat", label: "攻击", unit: "", step: 1, inputType: "raw", defaultValue: 3 },
  { key: "attackPercent", label: "攻击加成", unit: "%", step: 1, inputType: "decimalPercent", defaultValue: 8 },
  { key: "defenseFlat", label: "防御", unit: "", step: 1, inputType: "raw", defaultValue: 2 },
  { key: "defensePercent", label: "防御加成", unit: "%", step: 1, inputType: "decimalPercent", defaultValue: 5 },
  { key: "speedFlat", label: "速度", unit: "", step: 1, inputType: "raw", defaultValue: 2 },
  { key: "speedPercent", label: "速度加成", unit: "%", step: 1, inputType: "decimalPercent", defaultValue: 5 },
  { key: "hitRateFlat", label: "命中修正", unit: "%", step: 1, inputType: "raw", defaultValue: 2 },
  { key: "dodgeRateFlat", label: "闪避修正", unit: "%", step: 1, inputType: "raw", defaultValue: 2 },
  { key: "critRateFlat", label: "暴击修正", unit: "%", step: 1, inputType: "raw", defaultValue: 2 },
  { key: "innerPowerFlat", label: "内力", unit: "", step: 1, inputType: "raw", defaultValue: 20 },
  { key: "spiritualPowerFlat", label: "灵力", unit: "", step: 1, inputType: "raw", defaultValue: 10 },
  { key: "spiritShieldFlat", label: "灵力护盾", unit: "", step: 1, inputType: "raw", defaultValue: 20 },
  { key: "spellPowerFlat", label: "法术强度", unit: "", step: 1, inputType: "raw", defaultValue: 5 },
  { key: "spellPowerPercent", label: "法强加成", unit: "%", step: 1, inputType: "decimalPercent", defaultValue: 10 },
];

export const growthEffectOptions: EffectOption[] = [
  { key: "cultivationSpeedMultiplier", label: "修炼速度倍率", unit: "%", step: 5, inputType: "multiplierPercent", defaultValue: 110 },
  { key: "hpGrowthMultiplier", label: "HP成长倍率", unit: "%", step: 5, inputType: "multiplierPercent", defaultValue: 105 },
  { key: "breakthroughBonus", label: "突破成功修正", unit: "%", step: 1, inputType: "raw", defaultValue: 5 },
  { key: "opportunityBonus", label: "机缘触发修正", unit: "%", step: 1, inputType: "raw", defaultValue: 5 },
  { key: "resourceCostMultiplier", label: "资源消耗倍率", unit: "%", step: 5, inputType: "multiplierPercent", defaultValue: 100 },
  { key: "sideEffectRisk", label: "副作用风险", unit: "", step: 1, inputType: "raw", defaultValue: 5 },
  { key: "bagCapacityFlat", label: "背包容量", unit: "格", step: 1, inputType: "raw", defaultValue: 8 },
];
