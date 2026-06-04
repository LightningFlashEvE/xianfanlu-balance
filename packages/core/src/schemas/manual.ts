import { z } from "zod";
import { itemQualityIdSchema } from "../data/item-quality";
import { realmNameSchema } from "../data/realm-names";
import { combatEffectsSchema, growthEffectsSchema } from "./effects";

const qualityEnum = z.enum(itemQualityIdSchema);
const maxRealmEnum = z.enum(realmNameSchema);

export const manualDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  rank: z.string().min(1),
  quality: qualityEnum.default("凡品"),
  maxRealm: maxRealmEnum.default("普通凡人"),
  combat: combatEffectsSchema.default({}),
  growth: growthEffectsSchema.default({}),
  note: z.string().optional(),
});

export const manualInstanceSchema = manualDefSchema.extend({
  instanceId: z.string().min(1),
  enabled: z.boolean(),
  level: z.number().int().min(1).max(99).default(1),
  proficiency: z.string().min(1),
});

export type ManualDef = z.infer<typeof manualDefSchema>;
export type ManualInstance = z.infer<typeof manualInstanceSchema>;
