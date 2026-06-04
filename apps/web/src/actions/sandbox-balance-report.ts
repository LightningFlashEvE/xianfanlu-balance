"use server";

import { after } from "next/server";
import {
  applyBalanceRules,
  balanceAiVerdictSchema,
  buildBalanceAdjustmentHints,
  buildBalanceReportAiInput,
  buildBalanceReportPayload,
  summarizeEquipmentCatalog,
  summarizeHeroBaseline,
  type BalanceAdjustmentHints,
  type BalanceAiVerdict,
  type BalanceReportPayload,
  type BalanceRuleFlag,
} from "@xianfanlu/core";
import {
  balanceReportNow,
  logBalanceReport,
  logBalanceReportDone,
} from "@/lib/balance-report-log";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  chatMiniMaxForJudge,
  isLikelyTruncatedJsonError,
  parseBalanceAiRawContent,
  type MiniMaxChatMessage,
} from "@/lib/minimax";
import { loadBalanceState } from "./state";

const SYSTEM_PROMPT = `你是「仙凡录」数值平衡评审 AI。你只能根据用户提供的 JSON 数据做判断，禁止编造未出现的数字。

规则：
1. 不得建议修改 calculatePower、simulateDuel、makeCombatant 等核心公式。
2. 改进建议（recommendations）可指向：realms.initial.json、equipment.library.json、meta.json、enemyTemplateScale、沙盘 preset。
3. heroAdjustments 必须只改人物基底：hero.defaults.json 的 stats/aptitude、HeroConfig.combatMultiplier、enemyTemplateScale；每条写清 field、具体加减方向与幅度、evidence 引用胜率/战力。
4. equipmentAdjustments 必须指向具体装备：itemId 为 E001 等库 ID（或 sandbox-enemy-presets）；写清改 combat/growth 哪几项、约百分比、evidence 引用境界胜率或 audit。
5. 可参考 report.deterministicHints，但须结合 report.realmSweep / loadoutAudit / botStrategies 复核；勿与 issues 矛盾。
6. 破境看 realmSweep[].vsNextGate.duel.winChance（目标 38%–72%）；章节 BOSS 看 vsBandPreset（目标 25%–45%）。
7. 禁止输出 thinking，只输出一个 JSON 对象，不要 markdown，格式：
{
  "grade": "可发布" | "局部风险" | "不建议当前曲线上线",
  "summary": "",
  "issues": [{ "title": "", "severity": "P0"|"P1"|"P2", "evidence": "", "metric": "" }],
  "recommendations": [{ "priority": "P0"|"P1"|"P2", "target": "", "suggestion": "", "expectedEffect": "", "evidence": "" }],
  "heroAdjustments": [{ "priority": "P0"|"P1"|"P2", "target": "", "field": "", "currentHint": "", "suggestion": "", "affectedRealms": [], "evidence": "" }],
  "equipmentAdjustments": [{ "priority": "P0"|"P1"|"P2", "itemId": "", "itemName": "", "balanceRealm": "", "suggestion": "", "affectedRealms": [], "evidence": "" }]
}
存在明显守门/BOSS/养成问题时，heroAdjustments 与 equipmentAdjustments 各至少 2 条（可引用 deterministicHints）。`;

const CACHE_ID = 1;

export type SandboxBalanceReportResult = {
  ok: boolean;
  payload: BalanceReportPayload;
  ruleFlags: BalanceRuleFlag[];
  adjustmentHints: BalanceAdjustmentHints;
  ai: BalanceAiVerdict | null;
  aiError: string | null;
  rawContent: string | null;
  skippedAi: boolean;
  error: string | null;
};

export type BalanceReportCacheStatus = "idle" | "running" | "completed" | "failed";

export type BalanceReportCacheDto = {
  status: BalanceReportCacheStatus;
  startedAt: string | null;
  completedAt: string | null;
  result: SandboxBalanceReportResult | null;
  error: string | null;
};

export type StartBalanceReportResult = {
  started: boolean;
  message: string;
};

function toJsonResult(result: SandboxBalanceReportResult) {
  return JSON.parse(JSON.stringify(result)) as object;
}

function parseCachedResult(value: unknown): SandboxBalanceReportResult | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as SandboxBalanceReportResult;
  return {
    ...raw,
    adjustmentHints: raw.adjustmentHints ?? { hero: [], equipment: [] },
  };
}

function rowToDto(
  row: {
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
    result: unknown;
    error: string | null;
  } | null,
): BalanceReportCacheDto {
  if (!row) {
    return {
      status: "idle",
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
    };
  }
  const status = row.status as BalanceReportCacheStatus;
  return {
    status: ["idle", "running", "completed", "failed"].includes(status) ? status : "idle",
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    result: parseCachedResult(row.result),
    error: row.error,
  };
}

export async function getBalanceReportCache(): Promise<BalanceReportCacheDto> {
  const row = await prisma.balanceReportCache.findUnique({ where: { id: CACHE_ID } });
  return rowToDto(row);
}

export async function startBalanceReport(): Promise<StartBalanceReportResult> {
  const existing = await prisma.balanceReportCache.findUnique({ where: { id: CACHE_ID } });
  if (existing?.status === "running") {
    return { started: false, message: "报告正在生成中，请稍候刷新" };
  }

  const now = new Date();
  await prisma.balanceReportCache.upsert({
    where: { id: CACHE_ID },
    create: {
      id: CACHE_ID,
      status: "running",
      startedAt: now,
      completedAt: null,
      result: Prisma.JsonNull,
      error: null,
    },
    update: {
      status: "running",
      startedAt: now,
      completedAt: null,
      result: Prisma.JsonNull,
      error: null,
    },
  });

  after(async () => {
    await runBalanceReportJob();
  });

  return { started: true, message: "已开始后台生成，可离开本页" };
}

async function markCacheFailed(message: string) {
  await prisma.balanceReportCache.update({
    where: { id: CACHE_ID },
    data: {
      status: "failed",
      completedAt: new Date(),
      error: message,
      result: Prisma.JsonNull,
    },
  });
}

async function markCacheCompleted(result: SandboxBalanceReportResult) {
  await prisma.balanceReportCache.update({
    where: { id: CACHE_ID },
    data: {
      status: "completed",
      completedAt: new Date(),
      result: toJsonResult(result),
      error: null,
    },
  });
}

async function runBalanceReportJob(): Promise<void> {
  try {
    const result = await buildSandboxBalanceReportResult();
    await markCacheCompleted(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "生成报告失败";
    logBalanceReport(`后台任务失败: ${message}`);
    await markCacheFailed(message);
  }
}

async function buildSandboxBalanceReportResult(): Promise<SandboxBalanceReportResult> {
  const totalStart = balanceReportNow();
  logBalanceReport("开始生成平衡报告");

  let payload: BalanceReportPayload;
  let ruleFlags: BalanceRuleFlag[];
  let adjustmentHints: BalanceAdjustmentHints = { hero: [], equipment: [] };
  let state!: Awaited<ReturnType<typeof loadBalanceState>>;

  try {
    const loadStart = balanceReportNow();
    state = await loadBalanceState();
    logBalanceReportDone(
      `loadBalanceState（装备 ${state.equipment.length}、功法 ${state.manuals.length}、${state.attackerRealm} vs ${state.defenderRealm}）`,
      loadStart,
    );

    const scanStart = balanceReportNow();
    payload = buildBalanceReportPayload(state);
    const payloadKb = Math.round(JSON.stringify(payload).length / 1024);
    const matchCount = payload.botStrategies.reduce((n, b) => n + b.matches.length, 0);
    logBalanceReportDone(
      `buildBalanceReportPayload（realmSweep ${payload.realmSweep.length} 境、bot ${payload.botStrategies.length} 套 × ${matchCount} 场、loadoutAudit ${payload.loadoutAudit.length}、约 ${payloadKb} KB）`,
      scanStart,
    );

    const rulesStart = balanceReportNow();
    ruleFlags = applyBalanceRules(payload);
    logBalanceReportDone(`applyBalanceRules（${ruleFlags.length} 条规则告警）`, rulesStart);

    const hintsStart = balanceReportNow();
    adjustmentHints = buildBalanceAdjustmentHints(state, payload);
    logBalanceReportDone(
      `buildBalanceAdjustmentHints（人物 ${adjustmentHints.hero.length}、装备 ${adjustmentHints.equipment.length}）`,
      hintsStart,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "本地扫描失败";
    logBalanceReport(`失败: ${message}`);
    throw err;
  }

  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  if (!apiKey) {
    logBalanceReport("跳过 MiniMax（未配置 MINIMAX_API_KEY）");
    logBalanceReportDone("报告生成（仅本地）", totalStart);
    return {
      ok: true,
      payload,
      ruleFlags,
      adjustmentHints,
      ai: null,
      aiError: "未配置 MINIMAX_API_KEY，仅展示本地规则与 bot 数据",
      rawContent: null,
      skippedAi: true,
      error: null,
    };
  }

  try {
    const aiReport = buildBalanceReportAiInput(payload, ruleFlags, {
      heroBaseline: summarizeHeroBaseline(state),
      equipmentCatalog: summarizeEquipmentCatalog(state.equipment),
      deterministicHints: adjustmentHints,
    });
    const userContent = JSON.stringify(
      {
        report: aiReport,
        instructions:
          "请基于 report 完整数据输出平衡评审 JSON。realmSweep 含 vsNextGate/vsBandPreset 与 duel 快照；loadoutAudit 为全 15 境审计；botStrategies 含三套 bot 对 preset/当前守方胜率。须填写 heroAdjustments 与 equipmentAdjustments（结合 heroBaseline、equipmentCatalog、deterministicHints）。优先处理 warn 级 ruleFlags。",
      },
      null,
      0,
    );

    const aiKb = Math.round(userContent.length / 1024);
    const reportTimeoutSec = Math.round(resolveBalanceReportTimeoutMs() / 1000);
    logBalanceReport(
      `请求 MiniMax-M3（AI 完整 payload 约 ${aiKb} KB，超时 ${reportTimeoutSec}s）`,
    );

    const aiMessages: MiniMaxChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ];
    const aiOutcome = await requestBalanceAiVerdict(aiMessages);
    const parseStart = balanceReportNow();

    if (!aiOutcome.ok) {
      logBalanceReportDone("报告生成（AI 格式无效）", totalStart);
      return {
        ok: true,
        payload,
        ruleFlags,
        adjustmentHints,
        ai: null,
        aiError: aiOutcome.aiError,
        rawContent: aiOutcome.rawContent,
        skippedAi: false,
        error: null,
      };
    }

    const parsed = balanceAiVerdictSchema.safeParse(aiOutcome.verdict);
    const rawContent = aiOutcome.rawContent;

    if (!parsed.success) {
      logBalanceReport(`JSON 校验失败: ${parsed.error.message}`);
      logBalanceReportDone("报告生成（AI 格式无效）", totalStart);
      return {
        ok: true,
        payload,
        ruleFlags,
        adjustmentHints,
        ai: null,
        aiError: `AI 输出格式无效：${parsed.error.message}`,
        rawContent,
        skippedAi: false,
        error: null,
      };
    }

    logBalanceReportDone(`JSON 解析成功（${parsed.data.grade}）`, parseStart);
    logBalanceReportDone("报告生成", totalStart);

    return {
      ok: true,
      payload,
      ruleFlags,
      adjustmentHints,
      ai: parsed.data,
      aiError: null,
      rawContent: null,
      skippedAi: false,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "生成报告失败";
    logBalanceReport(`失败: ${message}`);
    logBalanceReportDone("报告生成（异常结束）", totalStart);
    return {
      ok: false,
      payload,
      ruleFlags,
      adjustmentHints,
      ai: null,
      aiError: message,
      rawContent: null,
      skippedAi: false,
      error: null,
    };
  }
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

type AiAttemptSpec = {
  label: string;
  maxTokens: number;
  jsonMode: boolean;
  disableThinking: boolean;
};

type AiVerdictOutcome =
  | { ok: true; verdict: unknown; rawContent: string }
  | { ok: false; aiError: string; rawContent: string | null };

function resolveBalanceReportTimeoutMs(): number {
  const reportRaw = process.env.BALANCE_REPORT_REQUEST_TIMEOUT_MS?.trim();
  if (reportRaw) {
    const n = Number(reportRaw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return parsePositiveInt(process.env.MINIMAX_REQUEST_TIMEOUT_MS, 300_000);
}

async function requestBalanceAiVerdict(messages: MiniMaxChatMessage[]): Promise<AiVerdictOutcome> {
  const timeoutMs = resolveBalanceReportTimeoutMs();
  const baseMax = parsePositiveInt(process.env.BALANCE_REPORT_AI_MAX_TOKENS, 8192);
  const retryMax = parsePositiveInt(process.env.BALANCE_REPORT_AI_MAX_TOKENS_RETRY, 16384);

  const call = async (spec: AiAttemptSpec) => {
    const aiStart = balanceReportNow();
    const result = await chatMiniMaxForJudge(messages, {
      maxCompletionTokens: spec.maxTokens,
      timeoutMs,
      jsonMode: spec.jsonMode,
      disableThinking: spec.disableThinking,
      reasoningSplit: true,
    });
    logBalanceReportDone(
      `MiniMax 响应（${spec.label}，${result.content.length} 字符，finish=${result.finishReason}）`,
      aiStart,
    );
    return result;
  };

  let lastRaw: string | null = null;
  let lastError = "未知错误";

  const first = await call({
    label: "json+split",
    maxTokens: baseMax,
    jsonMode: true,
    disableThinking: false,
  });
  lastRaw = first.content;
  let parsed = tryParseVerdict(first.content);
  if (parsed.ok) return parsed;

  lastError = parsed.aiError;
  const truncated =
    first.finishReason === "length" || isLikelyTruncatedJsonError(lastError);

  if (truncated) {
    logBalanceReport("首次输出可能被截断，使用 16384 token 重试");
    const second = await call({
      label: "json+split+16k",
      maxTokens: retryMax,
      jsonMode: true,
      disableThinking: false,
    });
    lastRaw = second.content;
    parsed = tryParseVerdict(second.content);
    if (parsed.ok) return parsed;
    lastError = parsed.aiError;
    if (second.finishReason !== "length" && !isLikelyTruncatedJsonError(lastError)) {
      logBalanceReport("改用非 json_mode 重试");
      const third = await call({
        label: "text+16k",
        maxTokens: retryMax,
        jsonMode: false,
        disableThinking: false,
      });
      lastRaw = third.content;
      parsed = tryParseVerdict(third.content);
      if (parsed.ok) return parsed;
      lastError = parsed.aiError;
    }
  }

  if (process.env.BALANCE_REPORT_DISABLE_THINKING === "1") {
    logBalanceReport("解析仍失败，使用 disableThinking 重试");
    const fourth = await call({
      label: "json+no-think",
      maxTokens: retryMax,
      jsonMode: true,
      disableThinking: true,
    });
    lastRaw = fourth.content;
    parsed = tryParseVerdict(fourth.content);
    if (parsed.ok) return parsed;
    lastError = parsed.aiError;
  }

  return {
    ok: false,
    aiError: `AI 输出无法解析为 JSON：${lastError}。可增大 BALANCE_REPORT_AI_MAX_TOKENS 或设 BALANCE_REPORT_DISABLE_THINKING=1 后重试。`,
    rawContent: lastRaw,
  };
}

function tryParseVerdict(rawContent: string): AiVerdictOutcome {
  try {
    const verdict = parseBalanceAiRawContent(rawContent);
    return { ok: true, verdict, rawContent };
  } catch (parseErr) {
    const message = parseErr instanceof Error ? parseErr.message : "AI 返回非 JSON";
    return { ok: false, aiError: message, rawContent };
  }
}

/** 同步生成（兼容旧调用；独立页请用 startBalanceReport） */
export async function generateSandboxBalanceReport(): Promise<SandboxBalanceReportResult> {
  return buildSandboxBalanceReportResult();
}
