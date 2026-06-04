import { z } from "zod";
import { aptitudeSchema, heroStatsSchema } from "./hero";
import { equipmentDefSchema } from "./equipment";
import { manualDefSchema } from "./manual";
import { realmSchema } from "./realm";

export const balanceExportSchema = z.object({
  game: z.literal("仙凡录"),
  balanceVersion: z.literal(2),
  exportedAt: z.string(),
  realms: z.array(realmSchema),
  equipment: z.array(equipmentDefSchema),
  manuals: z.array(manualDefSchema),
  heroDefaults: z.object({
    stats: heroStatsSchema,
    aptitude: aptitudeSchema,
    combatMultiplier: z.number(),
    baseBagCapacity: z.number(),
  }),
});

export type BalanceExportV2 = z.infer<typeof balanceExportSchema>;
