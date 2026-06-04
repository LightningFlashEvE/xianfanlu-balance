import { data } from "../data";
import type { ItemQualityId } from "../data/item-quality";
import { migrateLegacyItemQuality } from "../data/item-quality";
import { clampNumber, toNumber } from "../lib/numbers";
import type { ManualInstance } from "../schemas/manual";

const defaultProficiencyWeight = 0.3;
const defaultQualityScale: Record<ItemQualityId, number> = {
  凡品: 1,
  良品: 1.06,
  珍品: 1.14,
  绝品: 1.22,
  未知: 1,
};

function getManualBalanceConfig() {
  const balance = data.meta.manualBalance as
    | {
        proficiencyEffectWeight?: number;
        qualityCombatScale?: Partial<Record<ItemQualityId, number>>;
      }
    | undefined;
  return balance ?? {};
}

export function getProficiencyFactor(proficiency: string): number {
  const raw =
    data.meta.proficiencyOptions.find((option) => option.name === proficiency)?.scale ?? 0.3;
  const weight = getManualBalanceConfig().proficiencyEffectWeight ?? defaultProficiencyWeight;
  return 1 + (raw - 1) * weight;
}

export function getManualQualityScale(quality: string): number {
  const id = migrateLegacyItemQuality(quality);
  const scales = getManualBalanceConfig().qualityCombatScale;
  return scales?.[id] ?? defaultQualityScale[id] ?? 1;
}

export function getManualLevelScale(level: number | undefined): number {
  return clampNumber(1 + (toNumber(level, 1) - 1) * 0.05, 1, 1.25);
}

export function getManualEffectScale(
  manual: Pick<ManualInstance, "proficiency" | "level" | "quality">,
): number {
  return (
    getManualQualityScale(manual.quality) *
    getProficiencyFactor(manual.proficiency) *
    getManualLevelScale(manual.level)
  );
}
