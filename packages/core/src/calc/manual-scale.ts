import { data } from "../data";
import { clampNumber, toNumber } from "../lib/numbers";
import type { ManualInstance } from "../schemas/manual";

const defaultProficiencyWeight = 0.3;

function getManualBalanceConfig() {
  const balance = data.meta.manualBalance as
    | {
        proficiencyEffectWeight?: number;
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

export function getManualLevelScale(level: number | undefined): number {
  return clampNumber(1 + (toNumber(level, 1) - 1) * 0.05, 1, 1.25);
}

export function getManualEffectScale(
  manual: Pick<ManualInstance, "proficiency" | "level">,
): number {
  return getProficiencyFactor(manual.proficiency) * getManualLevelScale(manual.level);
}
