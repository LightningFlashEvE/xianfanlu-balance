import type { HeroStats } from "../schemas/hero";
import { makeCombatant } from "./duel";
import {
  calculatePower,
  type CalculatePowerOptions,
  type PowerBreakdown,
} from "./power";

export type RatedPowerParams = {
  stats: HeroStats;
  realmMultiplier: number;
  /** HeroConfig.combatMultiplier；内部按 simulateDuel 取 √ */
  potentialMultiplier: number;
  templateScale?: number;
  options?: CalculatePowerOptions;
};

export function scalePotentialForCombatant(potentialMultiplier: number): number {
  return Math.sqrt(Math.max(potentialMultiplier, 0.01));
}

export function toRatedCombatant(
  stats: HeroStats,
  realmMultiplier: number,
  potentialMultiplier: number,
  templateScale = 1,
): HeroStats {
  return makeCombatant(
    stats,
    realmMultiplier,
    scalePotentialForCombatant(potentialMultiplier),
    templateScale,
  );
}

/** 与 simulateDuel 的 heroPower / enemyPower 同源：makeCombatant + calculatePower(1, 1) */
export function calculateRatedPower(params: RatedPowerParams): PowerBreakdown {
  const templateScale = params.templateScale ?? 1;
  const combatant = toRatedCombatant(
    params.stats,
    params.realmMultiplier,
    params.potentialMultiplier,
    templateScale,
  );
  const breakdown = calculatePower(combatant, 1, 1);

  let manualContribution = 0;
  if (params.options?.statsWithoutManuals) {
    const withoutCombatant = toRatedCombatant(
      params.options.statsWithoutManuals,
      params.realmMultiplier,
      params.potentialMultiplier,
      templateScale,
    );
    manualContribution = Math.max(
      0,
      breakdown.total - calculatePower(withoutCombatant, 1, 1).total,
    );
  }

  return { ...breakdown, manualContribution };
}
