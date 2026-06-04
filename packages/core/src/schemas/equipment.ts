import { z } from "zod";
import { balanceRealmBandIdSchema } from "../data/balance-realm-bands";
import { itemQualityIdSchema } from "../data/item-quality";
import { equipmentSlotSchema } from "../data/item-taxonomy";
import { combatEffectsSchema, growthEffectsSchema } from "./effects";

const balanceRealmEnum = z.enum(balanceRealmBandIdSchema);
const qualityEnum = z.enum(itemQualityIdSchema);
const slotEnum = z.enum(equipmentSlotSchema);

export const equipmentDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slot: slotEnum,
  category: z.string().min(1),
  quality: qualityEnum.default("凡品"),
  /** 标准养成大境界段（凡俗期、江湖期、炼气期等） */
  balanceRealm: balanceRealmEnum.default("凡俗期"),
  combat: combatEffectsSchema.default({}),
  growth: growthEffectsSchema.default({}),
  note: z.string().optional(),
});

export const equipmentInstanceSchema = equipmentDefSchema.extend({
  instanceId: z.string().min(1),
  enabled: z.boolean(),
});

export type EquipmentDef = z.infer<typeof equipmentDefSchema>;
export type EquipmentInstance = z.infer<typeof equipmentInstanceSchema>;
