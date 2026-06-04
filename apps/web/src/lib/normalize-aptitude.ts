import {
  aptitudeSchema,
  buildAptitudeSpiritualRoot,
  normalizeSpiritualRootElements,
  type Aptitude,
} from "@xianfanlu/core";

export function normalizeAptitude(raw: unknown): Aptitude {
  const partial = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<Aptitude>;
  const elements = normalizeSpiritualRootElements(partial);
  const rootFields = buildAptitudeSpiritualRoot(elements);
  return aptitudeSchema.parse({
    rootBone: partial.rootBone ?? 7,
    comprehension: partial.comprehension ?? 8,
    luck: partial.luck ?? 5,
    temperament: partial.temperament ?? 5,
    cultivationSpeed: partial.cultivationSpeed ?? 120,
    breakthroughBonus: partial.breakthroughBonus ?? 0,
    opportunityBonus: partial.opportunityBonus ?? 0,
    ...rootFields,
  });
}
