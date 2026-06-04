import { data } from "../data";
import { getSpiritualRootCountMultiplier } from "../data/spiritual-root";
import { toNumber } from "../lib/numbers";
import type { Aptitude } from "../schemas/hero";

export function calculateProgression(growthBonus: Record<string, number>, aptitude: Aptitude) {
  const rootBoneMultiplier = 0.82 + aptitude.rootBone * 0.04;
  const comprehensionMultiplier = 0.76 + aptitude.comprehension * 0.055;
  const temperamentMultiplier = 0.86 + aptitude.temperament * 0.03;
  const luckBonus = (aptitude.luck - 5) * 3;
  const rootCount = aptitude.spiritualRootElements.length;
  const spiritualRootMultiplier = getSpiritualRootCountMultiplier(
    rootCount,
    data.meta.spiritualRootCountMultipliers,
  );
  const aptitudeSpeedMultiplier = comprehensionMultiplier * spiritualRootMultiplier;
  const manualSpeedMultiplier = toNumber(growthBonus.cultivationSpeedMultiplier, 1);
  const cultivationSpeed = aptitude.cultivationSpeed * aptitudeSpeedMultiplier * manualSpeedMultiplier;
  const breakthroughBonus =
    aptitude.breakthroughBonus +
    (aptitude.rootBone - 5) * 2 +
    (aptitude.temperament - 5) * 1.5 +
    toNumber(growthBonus.breakthroughBonus, 0) -
    toNumber(growthBonus.sideEffectRisk, 0);
  const opportunityBonus =
    aptitude.opportunityBonus + luckBonus + toNumber(growthBonus.opportunityBonus, 0);

  return {
    rootBoneMultiplier,
    comprehensionMultiplier,
    temperamentMultiplier,
    spiritualRootMultiplier,
    aptitudeSpeedMultiplier,
    manualSpeedMultiplier,
    cultivationSpeed,
    breakthroughBonus,
    opportunityBonus,
    hpGrowth: rootBoneMultiplier * toNumber(growthBonus.hpGrowthMultiplier, 1),
    attackGrowth: rootBoneMultiplier * toNumber(growthBonus.attackGrowthMultiplier, 1),
    defenseGrowth: rootBoneMultiplier * toNumber(growthBonus.defenseGrowthMultiplier, 1),
    spiritualGrowth: spiritualRootMultiplier * toNumber(growthBonus.spiritualGrowthMultiplier, 1),
    divineSenseGrowth: comprehensionMultiplier * toNumber(growthBonus.divineSenseGrowthMultiplier, 1),
    resourceCostMultiplier: toNumber(growthBonus.resourceCostMultiplier, 1),
    sideEffectRisk: toNumber(growthBonus.sideEffectRisk, 0),
  };
}
