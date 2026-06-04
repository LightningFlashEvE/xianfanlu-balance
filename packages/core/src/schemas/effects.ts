import { z } from "zod";

export const combatEffectKeys = [
  "hpFlat",
  "hpPercent",
  "staminaFlat",
  "staminaPercent",
  "attackFlat",
  "attackPercent",
  "defenseFlat",
  "defensePercent",
  "speedFlat",
  "speedPercent",
  "hitRateFlat",
  "dodgeRateFlat",
  "critRateFlat",
  "critDamageFlat",
  "innerPowerFlat",
  "innerPowerPercent",
  "spiritualPowerFlat",
  "spiritualPowerPercent",
  "spiritShieldFlat",
  "spiritShieldPercent",
  "divineSenseFlat",
  "divineSensePercent",
  "spellPowerFlat",
  "spellPowerPercent",
] as const;

export const growthEffectKeys = [
  "cultivationSpeedMultiplier",
  "hpGrowthMultiplier",
  "attackGrowthMultiplier",
  "defenseGrowthMultiplier",
  "spiritualGrowthMultiplier",
  "divineSenseGrowthMultiplier",
  "breakthroughBonus",
  "opportunityBonus",
  "resourceCostMultiplier",
  "sideEffectRisk",
  "bagCapacityFlat",
] as const;

const combatShape = Object.fromEntries(combatEffectKeys.map((k) => [k, z.number().optional()])) as Record<
  (typeof combatEffectKeys)[number],
  z.ZodOptional<z.ZodNumber>
>;

const growthShape = Object.fromEntries(growthEffectKeys.map((k) => [k, z.number().optional()])) as Record<
  (typeof growthEffectKeys)[number],
  z.ZodOptional<z.ZodNumber>
>;

export const combatEffectsSchema = z.object(combatShape).strict().partial();
export const growthEffectsSchema = z.object(growthShape).strict().partial();

export type CombatEffects = z.infer<typeof combatEffectsSchema>;
export type GrowthEffects = z.infer<typeof growthEffectsSchema>;

export function normalizeEffectMap(effects: unknown): Record<string, number> {
  if (!effects || typeof effects !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(effects as Record<string, unknown>)
      .map(([key, value]) => [key.trim(), Number(value)])
      .filter(([key, value]) => key && Number.isFinite(value)),
  );
}
