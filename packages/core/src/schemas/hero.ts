import { z } from "zod";
import { fiveElements } from "../data/spiritual-root";

const fiveElementSchema = z.enum(fiveElements);

export const heroStatsSchema = z.object({
  level: z.number(),
  hp: z.number(),
  stamina: z.number(),
  attack: z.number(),
  defense: z.number(),
  speed: z.number(),
  hitRate: z.number(),
  dodgeRate: z.number(),
  critRate: z.number(),
  critDamage: z.number(),
  attackInterval: z.number(),
  innerPower: z.number(),
  spiritualPower: z.number(),
  spiritShield: z.number(),
  divineSense: z.number(),
  spellPower: z.number(),
});

export const aptitudeSchema = z.object({
  rootBone: z.number(),
  comprehension: z.number(),
  /** 派生展示名，由 spiritualRootElements 生成 */
  spiritualRoot: z.string(),
  spiritualRootElements: z.array(fiveElementSchema).min(1).max(5),
  luck: z.number(),
  temperament: z.number(),
  cultivationSpeed: z.number(),
  breakthroughBonus: z.number(),
  opportunityBonus: z.number(),
});

export type HeroStats = z.infer<typeof heroStatsSchema>;
export type Aptitude = z.infer<typeof aptitudeSchema>;
