import { z } from "zod";

export const balanceAiIssueSchema = z.object({
  title: z.string(),
  severity: z.enum(["P0", "P1", "P2"]),
  evidence: z.string(),
  metric: z.string().optional(),
});

export const balanceAiRecommendationSchema = z.object({
  priority: z.enum(["P0", "P1", "P2"]),
  target: z.string(),
  suggestion: z.string(),
  expectedEffect: z.string(),
  evidence: z.string().optional(),
});

export const balanceAiHeroAdjustmentSchema = z.object({
  priority: z.enum(["P0", "P1", "P2"]),
  target: z.string(),
  field: z.string(),
  currentHint: z.string().optional(),
  suggestion: z.string(),
  affectedRealms: z.array(z.string()).optional(),
  evidence: z.string(),
});

export const balanceAiEquipmentAdjustmentSchema = z.object({
  priority: z.enum(["P0", "P1", "P2"]),
  itemId: z.string(),
  itemName: z.string().optional(),
  balanceRealm: z.string().optional(),
  suggestion: z.string(),
  affectedRealms: z.array(z.string()).optional(),
  evidence: z.string(),
});

export const balanceAdjustmentHintsSchema = z.object({
  hero: z.array(balanceAiHeroAdjustmentSchema),
  equipment: z.array(balanceAiEquipmentAdjustmentSchema),
});

export const balanceAiVerdictSchema = z.object({
  grade: z.enum(["可发布", "局部风险", "不建议当前曲线上线"]),
  summary: z.string(),
  issues: z.array(balanceAiIssueSchema),
  recommendations: z.array(balanceAiRecommendationSchema),
  heroAdjustments: z.array(balanceAiHeroAdjustmentSchema).default([]),
  equipmentAdjustments: z.array(balanceAiEquipmentAdjustmentSchema).default([]),
});

export type BalanceAiIssue = z.infer<typeof balanceAiIssueSchema>;
export type BalanceAiRecommendation = z.infer<typeof balanceAiRecommendationSchema>;
export type BalanceAiHeroAdjustment = z.infer<typeof balanceAiHeroAdjustmentSchema>;
export type BalanceAiEquipmentAdjustment = z.infer<typeof balanceAiEquipmentAdjustmentSchema>;
export type BalanceAdjustmentHints = z.infer<typeof balanceAdjustmentHintsSchema>;
export type BalanceAiVerdict = z.infer<typeof balanceAiVerdictSchema>;
