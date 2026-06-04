import type { Aptitude, HeroStats } from "../schemas/hero";
import type { EquipmentInstance } from "../schemas/equipment";
import type { ManualInstance } from "../schemas/manual";
import { addGrowthEffects, addScaledEffects, applyCombatEffects, createEmptyGrowthBonus } from "./effects";
import { calculateProgression } from "./progression";
import { getManualEffectScale } from "./manual-scale";

export type EvaluationInput = {
  baseStats: HeroStats;
  aptitude: Aptitude;
  equipment: EquipmentInstance[];
  manuals: ManualInstance[];
  equipmentIds: string[];
  includeManuals?: boolean;
  /**
   * enabled：仅计入 enabled 功法（沙盘实验台）
   * milestone：manuals 已由调用方按标准养成筛好，不再看 enabled
   */
  manualFilter?: "enabled" | "milestone";
};

export function getEquipmentByIds(equipment: EquipmentInstance[], ids: string[]) {
  return ids
    .map((id) => equipment.find((item) => item.instanceId === id))
    .filter((item): item is EquipmentInstance => Boolean(item));
}

export function getEvaluationContext(input: EvaluationInput) {
  const {
    baseStats,
    aptitude,
    equipment,
    manuals,
    equipmentIds,
    includeManuals = true,
    manualFilter = "enabled",
  } = input;
  const activeEquipment = getEquipmentByIds(equipment, equipmentIds);
  const activeManuals = !includeManuals
    ? []
    : manualFilter === "milestone"
      ? manuals
      : manuals.filter((item) => item.enabled);
  const combatBonus: Record<string, number> = {};
  const growthBonus = createEmptyGrowthBonus();

  activeEquipment.forEach((item) => {
    addScaledEffects(combatBonus, item.combat, 1);
    addGrowthEffects(growthBonus, item.growth, 1);
  });

  if (includeManuals) {
    activeManuals.forEach((manual) => {
      const scale = getManualEffectScale(manual);
      addScaledEffects(combatBonus, manual.combat, scale);
      addGrowthEffects(growthBonus, manual.growth, scale);
    });
  }

  const stats = applyCombatEffects(baseStats, combatBonus);
  const progression = calculateProgression(growthBonus, aptitude);

  return {
    stats,
    combatBonus,
    growthBonus,
    progression,
    activeEquipment,
    activeManuals,
  };
}
