import { z } from "zod";
import { balanceRealmBandIdSchema } from "../data/balance-realm-bands";
import { itemQualityIdSchema } from "../data/item-quality";
import { equipmentSlotSchema } from "../data/item-taxonomy";
import { combatEffectsSchema, growthEffectsSchema } from "./effects";

const balanceRealmEnum = z.enum(balanceRealmBandIdSchema);
const qualityEnum = z.enum(itemQualityIdSchema);
const slotEnum = z.enum(equipmentSlotSchema);
const tagListSchema = z.array(z.string().min(1)).default([]);

export const equipmentDefSchema = z.object({
  id: z.string().min(1),
  baseId: z.string().min(1).optional(),
  name: z.string().min(1),
  slot: slotEnum,
  category: z.string().min(1),
  quality: qualityEnum.default("凡品"),
  /** 标准养成大境界段（凡俗期、江湖期、炼气期等） */
  balanceRealm: balanceRealmEnum.default("凡俗期"),
  dropTags: tagListSchema,
  forgeTags: tagListSchema,
  upgradeTier: z.number().int().min(0).default(0),
  affixSlots: z.number().int().min(0).max(6).default(0),
  affixTags: tagListSchema,
  combat: combatEffectsSchema.default({}),
  growth: growthEffectsSchema.default({}),
  /** 飞升继承相关元数据 */
  ascension: z
    .object({
      /** 是否可炼化（凡品不可，良品以上可） */
      canRefine: z.boolean().default(false),
      /** 最高炼化等级（0=不可炼，2=灵品，3=宝品，4=仙品） */
      maxRefineTier: z.number().int().min(0).max(4).default(0),
      /** 器灵名字（预设，不填则自动生成） */
      spiritName: z.string().optional(),
      /** 器灵技能提示（描述这个器灵的特色） */
      spiritSkillHint: z.string().optional(),
    })
    .optional(),
  note: z.string().optional(),
});

export const equipmentInstanceSchema = equipmentDefSchema.extend({
  instanceId: z.string().min(1),
  enabled: z.boolean(),
});

export type EquipmentDef = z.infer<typeof equipmentDefSchema>;
export type EquipmentInstance = z.infer<typeof equipmentInstanceSchema>;
