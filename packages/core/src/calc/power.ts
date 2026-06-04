import { clampNumber } from "../lib/numbers";
import type { HeroStats } from "../schemas/hero";
import { calculateRatedPower } from "./rated-power";

export type PowerBreakdown = {
  total: number;
  base: number;
  martialDps: number;
  durability: number;
  resource: number;
  mystic: number;
  levelFactor: number;
  manualContribution: number;
};

export type CalculatePowerOptions = {
  statsWithoutManuals?: HeroStats;
};

export function calculateManualPowerContribution(
  statsWithManuals: HeroStats,
  statsWithoutManuals: HeroStats,
  realmMultiplier: number,
  potentialMultiplier: number,
  templateScale = 1,
): number {
  const withPower = calculateRatedPower({
    stats: statsWithManuals,
    realmMultiplier,
    potentialMultiplier,
    templateScale,
  }).total;
  const withoutPower = calculateRatedPower({
    stats: statsWithoutManuals,
    realmMultiplier,
    potentialMultiplier,
    templateScale,
  }).total;
  return Math.max(0, withPower - withoutPower);
}

export function calculatePower(
  stats: HeroStats,
  realmMultiplier: number,
  potentialMultiplier: number,
  options?: CalculatePowerOptions,
): PowerBreakdown {
  const hit = clampNumber(stats.hitRate / 100, 0.05, 0.99);
  const critRate = clampNumber(stats.critRate / 100, 0, 1);
  const critDamage = Math.max(stats.critDamage / 100, 1);
  const critFactor = 1 + critRate * (critDamage - 1);
  const interval = Math.max(stats.attackInterval, 0.2);
  const speedFactor = 1 + stats.speed / 220;
  const levelFactor = 1 + Math.max(stats.level - 1, 0) * 0.06;

  const martialDps = (stats.attack * hit * critFactor * speedFactor) / interval;
  const durability =
    (stats.hp + stats.spiritShield) *
    (1 + stats.defense / (stats.defense + 60)) *
    (1 + stats.dodgeRate / 180);
  const resource = stats.stamina * 0.16 + stats.innerPower * 0.32 + stats.spiritualPower * 0.42;
  const mystic = stats.spellPower * 1.35 + stats.spiritualPower * 0.2 + stats.divineSense * 0.55;
  const base = martialDps * 20 + durability * 0.65 + resource + mystic * 5;
  const total = base * realmMultiplier * potentialMultiplier * levelFactor;

  const manualContribution = options?.statsWithoutManuals
    ? calculateManualPowerContribution(
        stats,
        options.statsWithoutManuals,
        realmMultiplier,
        potentialMultiplier,
      )
    : 0;

  return {
    total,
    base,
    martialDps,
    durability,
    resource,
    mystic,
    levelFactor,
    manualContribution,
  };
}
