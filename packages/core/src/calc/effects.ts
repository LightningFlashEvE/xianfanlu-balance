import { normalizeEffectMap } from "../schemas/effects";
import { toNumber } from "../lib/numbers";
import type { HeroStats } from "../schemas/hero";

export function addScaledEffects(
  target: Record<string, number>,
  effects: unknown,
  scale: number,
): void {
  Object.entries(normalizeEffectMap(effects)).forEach(([key, value]) => {
    target[key] = toNumber(target[key], 0) + value * scale;
  });
}

export function addGrowthEffects(
  target: Record<string, number>,
  effects: unknown,
  scale: number,
): void {
  Object.entries(normalizeEffectMap(effects)).forEach(([key, value]) => {
    if (key.endsWith("Multiplier")) {
      target[key] = 1 + (toNumber(target[key], 1) - 1) + (value - 1) * scale;
    } else {
      target[key] = toNumber(target[key], 0) + value * scale;
    }
  });
}

export function applyCombatEffects(baseStats: HeroStats, effects: Record<string, number>): HeroStats {
  const stats = { ...baseStats };
  const flatMap: Record<string, keyof HeroStats> = {
    hpFlat: "hp",
    staminaFlat: "stamina",
    attackFlat: "attack",
    defenseFlat: "defense",
    speedFlat: "speed",
    hitRateFlat: "hitRate",
    dodgeRateFlat: "dodgeRate",
    critRateFlat: "critRate",
    critDamageFlat: "critDamage",
    innerPowerFlat: "innerPower",
    spiritualPowerFlat: "spiritualPower",
    spiritShieldFlat: "spiritShield",
    divineSenseFlat: "divineSense",
    spellPowerFlat: "spellPower",
  };
  const percentMap: Record<string, keyof HeroStats> = {
    hpPercent: "hp",
    staminaPercent: "stamina",
    attackPercent: "attack",
    defensePercent: "defense",
    speedPercent: "speed",
    innerPowerPercent: "innerPower",
    spiritualPowerPercent: "spiritualPower",
    spiritShieldPercent: "spiritShield",
    divineSensePercent: "divineSense",
    spellPowerPercent: "spellPower",
  };

  Object.entries(flatMap).forEach(([key, statKey]) => {
    stats[statKey] += toNumber(effects[key], 0);
  });
  Object.entries(percentMap).forEach(([key, statKey]) => {
    stats[statKey] *= 1 + toNumber(effects[key], 0);
  });

  stats.hitRate = Math.min(Math.max(stats.hitRate, 0), 100);
  stats.dodgeRate = Math.min(Math.max(stats.dodgeRate, 0), 95);
  stats.critRate = Math.min(Math.max(stats.critRate, 0), 100);
  stats.critDamage = Math.max(stats.critDamage, 100);
  return stats;
}

export function createEmptyGrowthBonus(): Record<string, number> {
  return {
    cultivationSpeedMultiplier: 1,
    hpGrowthMultiplier: 1,
    attackGrowthMultiplier: 1,
    defenseGrowthMultiplier: 1,
    spiritualGrowthMultiplier: 1,
    divineSenseGrowthMultiplier: 1,
    breakthroughBonus: 0,
    opportunityBonus: 0,
    resourceCostMultiplier: 1,
    sideEffectRisk: 0,
  };
}
