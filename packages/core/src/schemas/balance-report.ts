import { z } from "zod";

const requiredText = z.string().trim().min(1);

function suggestionFromAliases<T extends { suggestion: string }>(obj: T) {
  const direction = (obj as Record<string, unknown>).direction;
  return {
    ...obj,
    suggestion:
      obj.suggestion.trim() ||
      (typeof direction === "string" ? direction.trim() : ""),
  };
}

export const balanceAiIssueSchema = z.object({
  title: requiredText,
  severity: z.enum(["P0", "P1", "P2"]),
  evidence: requiredText,
  metric: requiredText.optional(),
}).passthrough();

export const balanceAiRecommendationSchema = z.object({
  priority: z.enum(["P0", "P1", "P2"]),
  target: requiredText,
  suggestion: requiredText,
  expectedEffect: requiredText,
  evidence: requiredText.optional(),
}).passthrough();

export const balanceAiHeroAdjustmentSchema = z.object({
  priority: z.enum(["P0", "P1", "P2"]),
  target: requiredText,
  field: requiredText,
  currentHint: z.string().optional(),
  suggestion: z.string().default(""),
  affectedRealms: z.array(z.string()).optional(),
  evidence: requiredText,
}).passthrough().transform((obj) => {
  return suggestionFromAliases(obj);
}).pipe(z.object({
  priority: z.enum(["P0", "P1", "P2"]),
  target: requiredText,
  field: requiredText,
  currentHint: z.string().optional(),
  suggestion: requiredText,
  affectedRealms: z.array(requiredText).optional(),
  evidence: requiredText,
}).passthrough());

export const balanceAiEquipmentAdjustmentSchema = z.object({
  priority: z.enum(["P0", "P1", "P2"]),
  itemId: requiredText,
  itemName: requiredText.optional(),
  balanceRealm: requiredText.optional(),
  suggestion: z.string().default(""),
  affectedRealms: z.array(requiredText).optional(),
  evidence: requiredText,
}).passthrough().transform((obj) => {
  return suggestionFromAliases(obj);
}).pipe(z.object({
  priority: z.enum(["P0", "P1", "P2"]),
  itemId: requiredText,
  itemName: requiredText.optional(),
  balanceRealm: requiredText.optional(),
  suggestion: requiredText,
  affectedRealms: z.array(requiredText).optional(),
  evidence: requiredText,
}).passthrough());

export const balanceAdjustmentHintsSchema = z.object({
  hero: z.array(balanceAiHeroAdjustmentSchema),
  equipment: z.array(balanceAiEquipmentAdjustmentSchema),
});

export const balanceAiVerdictSchema = z.object({
  grade: z.enum(["可发布", "局部风险", "不建议当前曲线上线"]),
  summary: requiredText,
  issues: z.array(balanceAiIssueSchema).min(1),
  recommendations: z.array(balanceAiRecommendationSchema).min(1),
  heroAdjustments: z.array(balanceAiHeroAdjustmentSchema).default([]),
  equipmentAdjustments: z.array(balanceAiEquipmentAdjustmentSchema).default([]),
}).passthrough();

export type BalanceAiIssue = z.infer<typeof balanceAiIssueSchema>;
export type BalanceAiRecommendation = z.infer<typeof balanceAiRecommendationSchema>;
export type BalanceAiHeroAdjustment = z.infer<typeof balanceAiHeroAdjustmentSchema>;
export type BalanceAiEquipmentAdjustment = z.infer<typeof balanceAiEquipmentAdjustmentSchema>;
export type BalanceAdjustmentHints = z.infer<typeof balanceAdjustmentHintsSchema>;
export type BalanceAiVerdict = z.infer<typeof balanceAiVerdictSchema>;
