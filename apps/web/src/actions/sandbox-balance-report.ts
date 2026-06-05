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
  chatMiniMaxStreamForJudge,
  isLikelyTruncatedJsonError,
  parseBalanceAiRawContent,
  type MiniMaxChatMessage,
  type MiniMaxStreamChunk,
  type MiniMaxStreamResult,
  type MiniMaxTokenUsage,
} from "@/lib/minimax";
import { loadBalanceState } from "./state";

const SYSTEM_PROMPT = `你是「仙凡录」数值平衡评审 AI。你只能根据用户提供的 JSON 数据做判断，禁止编造未出现的数字。

**最高优先级规则（违反则输出无效）：
JSON 的顶层必须包含以下 6 个字段，一个都不能少：
- grade: "可发布" | "局部风险" | "不建议当前曲线上线"（三者选一）
- summary: 一段话总评（50–150 字），概括当前曲线的主要问题
- issues: 问题列表（数组），至少 1 条，用 severity 标注 P0/P1/P2
- recommendations: 改进建议列表（数组），至少 1 条
- heroAdjustments: 人物调整列表（数组，无调整时填 []）
- equipmentAdjustments: 装备调整列表（数组，无调整时填 []）

**核心机制（必须理解，否则建议无效）：**
1. baseStats 共享：hero 和 enemy 使用相同的 baseStats，装备加成叠加在 baseStats 之上。上调 baseStats（如 stats.attack、stats.hp）会同时增强双方，对破境胜率影响极小甚至反向。
2. cultivationSpeed 无关战力：aptitude.cultivationSpeed 只影响修炼进度速度，不参与战力计算。禁止建议修改它来改善胜率。
3. combatMultiplier 只作用于 hero：公式为 sqrt(realmMult) * sqrt(combatMult)，仅提升 hero 侧 stats。小幅调整（如 1.42→1.48）可普适增强。
4. breakthroughGateTemplateScale 只作用于破境守门 enemy：降低它直接削弱守门敌方，不影响其他场景。这是修复破境偏弱的最有效手段。
5. chapterBossTemplateScale 只作用于章节 BOSS enemy：降低它直接削弱 BOSS，不影响其他场景。
6. 镜像对战胜率：双方使用相同 baseStats + 相同 combatMultiplier，若镜像胜率偏高说明 hero 装备/功法偏强，此时不应再上调 combatMultiplier。
7. 破境/BOSS 偏弱的首选修复顺序：① 降低对应 band 的 templateScale → ② 小幅上调 combatMultiplier → ③ 补 hero 装备数值。禁止首选上调 baseStats。

其余规则：
1. 不得建议修改 calculatePower、simulateDuel、makeCombatant 等核心公式。
2. recommendations 可指向：realms.initial.json、equipment.library.json、manuals.library.json、meta.json、sandbox-enemy-presets.ts。
3. heroAdjustments 必须只改人物基底或模板倍率：hero.defaults.json 的 stats/aptitude、HeroConfig.combatMultiplier、enemyTemplateScale、sandbox-enemy-presets.ts 的 breakthroughGateTemplateScale/chapterBossTemplateScale。
4. equipmentAdjustments 必须指向具体装备：itemId 为 E001 等库 ID（或 sandbox-enemy-presets）。
5. 可参考 report.deterministicHints，但须结合 report.realmSweep / loadoutAudit / botStrategies 复核；勿与 issues 矛盾。
6. 破境看 realmSweep[].vsNextGate.duel.winChance（目标 38%–72%）；章节 BOSS 看 vsBandPreset（目标 25%–45%）。
7. 存在明显守门/BOSS/养成问题时，heroAdjustments 与 equipmentAdjustments 各至少 2 条（可引用 deterministicHints）。
8. 禁止输出 thinking 或 markdown，只输出一个 JSON 对象。
9. 禁止自相矛盾：如果 issues 提到"镜像胜率偏高"，则 recommendations/heroAdjustments 不得建议上调 combatMultiplier 或 baseStats。

**字段名严格约束（禁止替换或省略）：**
- heroAdjustments 每条必须用这些字段名：priority, target, field, suggestion, evidence（不要用 direction 代替 suggestion）
- equipmentAdjustments 每条必须用这些字段名：priority, itemId, itemName, balanceRealm, suggestion, evidence（不要用 direction 代替 suggestion）

输出格式示例：
{
  "grade": "局部风险",
  "summary": "当前曲线凡俗期守门偏弱，破境胜率仅 3.8%……",
  "issues": [{ "title": "凡俗期破境守门模板过弱", "severity": "P0", "evidence": "普通凡人→江湖三流胜率 3.8%", "metric": "next_gate_weak" }],
  "recommendations": [{ "priority": "P0", "target": "sandbox-enemy-presets.ts", "suggestion": "凡俗期 breakthroughGateTemplateScale 0.86→0.78，直接削弱守门 enemy", "expectedEffect": "破境胜率升至 38% 以上", "evidence": "普通凡人 破境胜率 3.8%" }],
  "heroAdjustments": [{ "priority": "P0", "target": "sandbox-enemy-presets.ts", "field": "breakthroughGateTemplateScale", "suggestion": "凡俗期 0.86→0.78（约-9%），削弱守门 enemy stat", "evidence": "普通凡人 破境胜率 3.8%" }],
  "equipmentAdjustments": [{ "priority": "P1", "itemId": "E001", "itemName": "旧铁剑", "balanceRealm": "凡俗期", "suggestion": "attackFlat 4→5、hitRateFlat 1→2（约+27%）", "evidence": "普通凡人 破境胜率 3.8%" }]
}`;

const CACHE_ID = 1;

export type BalanceReportTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens: number;
  estimatedTokens: number;
  apiCallCount: number;
  pendingApiCallCount: number;
  unavailableCallCount: number;
  lastUpdatedAt: string | null;
};

export type SandboxBalanceReportResult = {
  ok: boolean;
  payload: BalanceReportPayload;
  ruleFlags: BalanceRuleFlag[];
  adjustmentHints: BalanceAdjustmentHints;
  tokenUsage: BalanceReportTokenUsage;
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
  tokenUsage: BalanceReportTokenUsage;
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

function createEmptyTokenUsage(): BalanceReportTokenUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    reasoningTokens: 0,
    estimatedTokens: 0,
    apiCallCount: 0,
    pendingApiCallCount: 0,
    unavailableCallCount: 0,
    lastUpdatedAt: null,
  };
}

function tokenUsageNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function parseTokenUsage(value: unknown): BalanceReportTokenUsage | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<BalanceReportTokenUsage>;
  return {
    promptTokens: tokenUsageNumber(raw.promptTokens),
    completionTokens: tokenUsageNumber(raw.completionTokens),
    totalTokens: tokenUsageNumber(raw.totalTokens),
    reasoningTokens: tokenUsageNumber(raw.reasoningTokens),
    estimatedTokens: tokenUsageNumber(raw.estimatedTokens),
    apiCallCount: tokenUsageNumber(raw.apiCallCount),
    pendingApiCallCount: tokenUsageNumber(raw.pendingApiCallCount),
    unavailableCallCount: tokenUsageNumber(raw.unavailableCallCount),
    lastUpdatedAt: typeof raw.lastUpdatedAt === "string" ? raw.lastUpdatedAt : null,
  };
}

function tokenUsageToJson(usage: BalanceReportTokenUsage) {
  return JSON.parse(JSON.stringify(usage)) as object;
}

function estimateTextTokens(text: string): number {
  const cjkCount = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const nonCjkCount = Math.max(0, text.length - cjkCount);
  return Math.max(1, Math.ceil(cjkCount * 1.1 + nonCjkCount / 4));
}

function estimatePromptTokens(messages: MiniMaxChatMessage[]): number {
  const text = messages.map((message) => `${message.role}\n${message.content}`).join("\n\n");
  return estimateTextTokens(text) + messages.length * 4;
}

function withTokenUsageUpdate(current: BalanceReportTokenUsage, patch: Partial<BalanceReportTokenUsage>) {
  return {
    ...current,
    ...patch,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function beginEstimatedTokenUsage(
  current: BalanceReportTokenUsage,
  promptEstimate: number,
): BalanceReportTokenUsage {
  return withTokenUsageUpdate(current, {
    promptTokens: current.promptTokens + promptEstimate,
    totalTokens: current.totalTokens + promptEstimate,
    estimatedTokens: current.estimatedTokens + promptEstimate,
    pendingApiCallCount: current.pendingApiCallCount + 1,
  });
}

function completeTokenUsage(
  current: BalanceReportTokenUsage,
  usage: MiniMaxTokenUsage | null,
  promptEstimate: number,
  content: string,
): BalanceReportTokenUsage {
  const completionEstimate = usage ? 0 : estimateTextTokens(content);
  const pendingApiCallCount = Math.max(0, current.pendingApiCallCount - 1);

  if (!usage) {
    return withTokenUsageUpdate(current, {
      completionTokens: current.completionTokens + completionEstimate,
      totalTokens: current.totalTokens + completionEstimate,
      estimatedTokens: current.estimatedTokens + completionEstimate,
      apiCallCount: current.apiCallCount + 1,
      pendingApiCallCount,
      unavailableCallCount: current.unavailableCallCount + 1,
    });
  }

  return withTokenUsageUpdate(current, {
    promptTokens: current.promptTokens - promptEstimate + usage.promptTokens,
    completionTokens: current.completionTokens + usage.completionTokens,
    totalTokens: current.totalTokens - promptEstimate + usage.totalTokens,
    reasoningTokens: current.reasoningTokens + usage.reasoningTokens,
    estimatedTokens: Math.max(0, current.estimatedTokens - promptEstimate),
    apiCallCount: current.apiCallCount + 1,
    pendingApiCallCount,
  });
}

function cancelEstimatedTokenUsage(
  current: BalanceReportTokenUsage,
  promptEstimate: number,
): BalanceReportTokenUsage {
  return withTokenUsageUpdate(current, {
    promptTokens: Math.max(0, current.promptTokens - promptEstimate),
    totalTokens: Math.max(0, current.totalTokens - promptEstimate),
    estimatedTokens: Math.max(0, current.estimatedTokens - promptEstimate),
    pendingApiCallCount: Math.max(0, current.pendingApiCallCount - 1),
  });
}

function parseCachedResult(value: unknown): SandboxBalanceReportResult | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as SandboxBalanceReportResult;
  return {
    ...raw,
    adjustmentHints: raw.adjustmentHints ?? { hero: [], equipment: [] },
    tokenUsage: parseTokenUsage(raw.tokenUsage) ?? createEmptyTokenUsage(),
  };
}

function rowToDto(
  row: {
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
    result: unknown;
    tokenUsage: unknown;
    error: string | null;
  } | null,
): BalanceReportCacheDto {
  if (!row) {
    return {
      status: "idle",
      startedAt: null,
      completedAt: null,
      tokenUsage: createEmptyTokenUsage(),
      result: null,
      error: null,
    };
  }
  const status = row.status as BalanceReportCacheStatus;
  const result = parseCachedResult(row.result);
  return {
    status: ["idle", "running", "completed", "failed"].includes(status) ? status : "idle",
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    tokenUsage: parseTokenUsage(row.tokenUsage) ?? result?.tokenUsage ?? createEmptyTokenUsage(),
    result,
    error: row.error,
  };
}

export async function getBalanceReportCache(): Promise<BalanceReportCacheDto> {
  const row = await prisma.balanceReportCache.findUnique({ where: { id: CACHE_ID } });
  return rowToDto(row);
}

export async function resetBalanceReport(): Promise<{ ok: boolean; message: string }> {
  try {
    await prisma.balanceReportCache.upsert({
      where: { id: CACHE_ID },
      create: {
        id: CACHE_ID,
        status: "idle",
        startedAt: null,
        completedAt: null,
        result: Prisma.JsonNull,
        tokenUsage: tokenUsageToJson(createEmptyTokenUsage()),
        error: null,
      },
      update: {
        status: "idle",
        startedAt: null,
        completedAt: null,
        result: Prisma.JsonNull,
        tokenUsage: tokenUsageToJson(createEmptyTokenUsage()),
        error: null,
      },
    });
    return { ok: true, message: "已重置" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "重置失败";
    return { ok: false, message };
  }
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
      tokenUsage: tokenUsageToJson(createEmptyTokenUsage()),
      error: null,
    },
    update: {
      status: "running",
      startedAt: now,
      completedAt: null,
      result: Prisma.JsonNull,
      tokenUsage: tokenUsageToJson(createEmptyTokenUsage()),
      error: null,
    },
  });

  after(async () => {
    await runBalanceReportJob();
  });

  return { started: true, message: "已开始后台生成，可离开本页" };
}

export async function markCacheFailed(message: string) {
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

export async function markCacheCompleted(result: SandboxBalanceReportResult) {
  await prisma.balanceReportCache.update({
    where: { id: CACHE_ID },
    data: {
      status: "completed",
      completedAt: new Date(),
      result: toJsonResult(result),
      tokenUsage: tokenUsageToJson(result.tokenUsage),
      error: null,
    },
  });
}

async function updateTokenUsageProgress(usage: BalanceReportTokenUsage) {
  await prisma.balanceReportCache.update({
    where: { id: CACHE_ID },
    data: {
      tokenUsage: tokenUsageToJson(usage),
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
  let tokenUsage = createEmptyTokenUsage();
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
      tokenUsage,
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
    const recordTokenUsageStart = async (promptEstimate: number, label: string) => {
      tokenUsage = beginEstimatedTokenUsage(tokenUsage, promptEstimate);
      await updateTokenUsageProgress(tokenUsage);
      // 流式日志已静音
    };
    const recordTokenUsageDone = async (
      usage: MiniMaxTokenUsage | null,
      label: string,
      promptEstimate: number,
      content: string,
    ) => {
      tokenUsage = completeTokenUsage(tokenUsage, usage, promptEstimate, content);
      await updateTokenUsageProgress(tokenUsage);
      // 流式日志已静音
    };
    const recordTokenUsageFailed = async (promptEstimate: number, label: string) => {
      tokenUsage = cancelEstimatedTokenUsage(tokenUsage, promptEstimate);
      await updateTokenUsageProgress(tokenUsage);
      // 流式日志已静音
    };
    const aiOutcome = await requestBalanceAiVerdict(aiMessages, {
      onAttemptStart: recordTokenUsageStart,
      onAttemptDone: recordTokenUsageDone,
      onAttemptFailed: recordTokenUsageFailed,
    });
    const parseStart = balanceReportNow();

    if (!aiOutcome.ok) {
      logBalanceReportDone("报告生成（AI 格式无效）", totalStart);
      return {
        ok: true,
        payload,
        ruleFlags,
        adjustmentHints,
        tokenUsage,
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
        tokenUsage,
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
      tokenUsage,
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
      tokenUsage,
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

async function requestBalanceAiVerdict(
  messages: MiniMaxChatMessage[],
  tokenUsageHooks?: {
    onAttemptStart?: (promptEstimate: number, label: string) => Promise<void> | void;
    onAttemptDone?: (
      usage: MiniMaxTokenUsage | null,
      label: string,
      promptEstimate: number,
      content: string,
    ) => Promise<void> | void;
    onAttemptFailed?: (promptEstimate: number, label: string) => Promise<void> | void;
  },
): Promise<AiVerdictOutcome> {
  const timeoutMs = resolveBalanceReportTimeoutMs();
  const baseMax = parsePositiveInt(process.env.BALANCE_REPORT_AI_MAX_TOKENS, 8192);
  const retryMax = parsePositiveInt(process.env.BALANCE_REPORT_AI_MAX_TOKENS_RETRY, 16384);

  const call = async (spec: AiAttemptSpec) => {
    const aiStart = balanceReportNow();
    const promptEstimate = estimatePromptTokens(messages);
    await tokenUsageHooks?.onAttemptStart?.(promptEstimate, spec.label);
    let result: Awaited<ReturnType<typeof chatMiniMaxForJudge>>;
    try {
      result = await chatMiniMaxForJudge(messages, {
        maxCompletionTokens: spec.maxTokens,
        timeoutMs,
        jsonMode: spec.jsonMode,
        disableThinking: spec.disableThinking,
        reasoningSplit: !spec.disableThinking,
      });
    } catch (err) {
      await tokenUsageHooks?.onAttemptFailed?.(promptEstimate, spec.label);
      throw err;
    }
    logBalanceReportDone(
      `MiniMax 响应（${spec.label}，${result.content.length} 字符，finish=${result.finishReason}）`,
      aiStart,
    );
    await tokenUsageHooks?.onAttemptDone?.(
      result.usage,
      spec.label,
      promptEstimate,
      result.content,
    );
    return result;
  };

  let lastRaw: string | null = null;
  let lastError = "未知错误";

  // 第一次：开启思考 + 默认 token；需要更大上限时用环境变量显式配置。
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

  // 截断时：使用重试 token 上限（仍开启思考）。
  if (truncated) {
    logBalanceReport(`首次输出可能被截断，使用 ${retryMax} token 重试（仍开启思考）`);
    const second = await call({
      label: "json+split+retry",
      maxTokens: retryMax,
      jsonMode: true,
      disableThinking: false,
    });
    lastRaw = second.content;
    parsed = tryParseVerdict(second.content);
    if (parsed.ok) return parsed;
    lastError = parsed.aiError;
  }

  if (process.env.BALANCE_REPORT_DISABLE_THINKING === "1") {
    // 显式配置后才关闭思考，作为解析失败后的最后兜底。
    logBalanceReport("开启思考仍失败，尝试关闭思考重试（所有 token 给 JSON）");
    const third = await call({
      label: "json+no-think+retry",
      maxTokens: retryMax,
      jsonMode: true,
      disableThinking: true,
    });
    lastRaw = third.content;
    parsed = tryParseVerdict(third.content);
    if (parsed.ok) return parsed;
    lastError = parsed.aiError;
  }

  return {
    ok: false,
    aiError: `AI 输出无法解析为 JSON：${lastError}。可增大 BALANCE_REPORT_AI_MAX_TOKENS，或设 BALANCE_REPORT_DISABLE_THINKING=1 后重试。`,
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

// ==================== 流式变体 ====================

export type StreamReportCallbacks = {
  onThinkingChunk?: (text: string) => Promise<void> | void;
  onProgress?: (label: string) => Promise<void> | void;
};

/**
 * 流式生成平衡报告。
 * 与 buildSandboxBalanceReportResult 结构相同，但 AI 请求使用流式，
 * thinking 内容通过 onThinkingChunk 回调实时推送。
 */
export async function buildSandboxBalanceReportStream(
  callbacks?: StreamReportCallbacks,
): Promise<SandboxBalanceReportResult> {
  const totalStart = balanceReportNow();
  let tokenUsage = createEmptyTokenUsage();
  // 流式日志已静音（网页实时显示思考内容）

  let payload: BalanceReportPayload;
  let ruleFlags: BalanceRuleFlag[];
  let adjustmentHints: BalanceAdjustmentHints = { hero: [], equipment: [] };
  let state!: Awaited<ReturnType<typeof loadBalanceState>>;

  try {
    const loadStart = balanceReportNow();
    state = await loadBalanceState();
    // 流式日志已静音（网页实时显示思考内容）

    const scanStart = balanceReportNow();
    payload = buildBalanceReportPayload(state);
    const payloadKb = Math.round(JSON.stringify(payload).length / 1024);
    const matchCount = payload.botStrategies.reduce((n, b) => n + b.matches.length, 0);
    // 流式日志已静音

    const rulesStart = balanceReportNow();
    ruleFlags = applyBalanceRules(payload);
    // 流式日志已静音

    const hintsStart = balanceReportNow();
    adjustmentHints = buildBalanceAdjustmentHints(state, payload);
    // 流式日志已静音
  } catch (err) {
    const message = err instanceof Error ? err.message : "本地扫描失败";
    logBalanceReport(`失败: ${message}`);
    throw err;
  }

  await callbacks?.onProgress?.("本地扫描完成，开始 AI 评审…");

  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  if (!apiKey) {
    // 流式日志已静音
    return {
      ok: true,
      payload,
      ruleFlags,
      adjustmentHints,
      tokenUsage,
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
    // 流式日志已静音

    const aiMessages: MiniMaxChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ];
    const recordTokenUsageStart = async (promptEstimate: number, label: string) => {
      tokenUsage = beginEstimatedTokenUsage(tokenUsage, promptEstimate);
      await updateTokenUsageProgress(tokenUsage);
      // 流式日志已静音
    };
    const recordTokenUsageDone = async (
      usage: MiniMaxTokenUsage | null,
      label: string,
      promptEstimate: number,
      content: string,
    ) => {
      tokenUsage = completeTokenUsage(tokenUsage, usage, promptEstimate, content);
      await updateTokenUsageProgress(tokenUsage);
      // 流式日志已静音
    };
    const recordTokenUsageFailed = async (promptEstimate: number, label: string) => {
      tokenUsage = cancelEstimatedTokenUsage(tokenUsage, promptEstimate);
      await updateTokenUsageProgress(tokenUsage);
      // 流式日志已静音
    };
    const aiOutcome = await requestBalanceAiVerdictStream(aiMessages, callbacks, {
      onAttemptStart: recordTokenUsageStart,
      onAttemptDone: recordTokenUsageDone,
      onAttemptFailed: recordTokenUsageFailed,
    });
    const parseStart = balanceReportNow();

    if (!aiOutcome.ok) {
      // 流式日志已静音
      return {
        ok: true,
        payload,
        ruleFlags,
        adjustmentHints,
        tokenUsage,
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
      // 流式日志已静音
      // 流式日志已静音
      return {
        ok: true,
        payload,
        ruleFlags,
        adjustmentHints,
        tokenUsage,
        ai: null,
        aiError: `AI 输出格式无效：${parsed.error.message}`,
        rawContent,
        skippedAi: false,
        error: null,
      };
    }

    // 流式日志已静音

    return {
      ok: true,
      payload,
      ruleFlags,
      adjustmentHints,
      tokenUsage,
      ai: parsed.data,
      aiError: null,
      rawContent: null,
      skippedAi: false,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "生成报告失败";
    logBalanceReport(`失败: ${message}`);
    // 流式日志已静音
    return {
      ok: false,
      payload,
      ruleFlags,
      adjustmentHints,
      tokenUsage,
      ai: null,
      aiError: message,
      rawContent: null,
      skippedAi: false,
      error: null,
    };
  }
}

/** 流式 AI 评审请求（与 requestBalanceAiVerdict 类似，但使用 stream） */
async function requestBalanceAiVerdictStream(
  messages: MiniMaxChatMessage[],
  callbacks: StreamReportCallbacks | undefined,
  tokenUsageHooks: {
    onAttemptStart?: (promptEstimate: number, label: string) => Promise<void> | void;
    onAttemptDone?: (
      usage: MiniMaxTokenUsage | null,
      label: string,
      promptEstimate: number,
      content: string,
    ) => Promise<void> | void;
    onAttemptFailed?: (promptEstimate: number, label: string) => Promise<void> | void;
  },
): Promise<AiVerdictOutcome> {
  const timeoutMs = resolveBalanceReportTimeoutMs();
  const baseMax = parsePositiveInt(process.env.BALANCE_REPORT_AI_MAX_TOKENS, 8192);
  const retryMax = parsePositiveInt(process.env.BALANCE_REPORT_AI_MAX_TOKENS_RETRY, 16384);

  const call = async (spec: AiAttemptSpec) => {
    const aiStart = balanceReportNow();
    const promptEstimate = estimatePromptTokens(messages);
    await tokenUsageHooks.onAttemptStart?.(promptEstimate, spec.label);

    let result: MiniMaxStreamResult;
    try {
      result = await consumeStream(spec, messages, timeoutMs, callbacks);
    } catch (err) {
      await tokenUsageHooks.onAttemptFailed?.(promptEstimate, spec.label);
      throw err;
    }
    // 流式日志已静音
    await tokenUsageHooks.onAttemptDone?.(
      result.usage,
      spec.label,
      promptEstimate,
      result.content,
    );
    return result;
  };

  let lastRaw: string | null = null;
  let lastError = "未知错误";

  // 第一次：开启思考 + 默认 token
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

  // 截断时：使用重试 token 上限（仍开启思考）
  if (truncated) {
    await callbacks?.onProgress?.("输出被截断，正在重试…");
    // 流式日志已静音
    const second = await call({
      label: "json+split+retry",
      maxTokens: retryMax,
      jsonMode: true,
      disableThinking: false,
    });
    lastRaw = second.content;
    parsed = tryParseVerdict(second.content);
    if (parsed.ok) return parsed;
    lastError = parsed.aiError;
  }

  if (process.env.BALANCE_REPORT_DISABLE_THINKING === "1") {
    await callbacks?.onProgress?.("开启思考仍失败，尝试关闭思考重试…");
    // 流式日志已静音
    const third = await call({
      label: "json+no-think+retry",
      maxTokens: retryMax,
      jsonMode: true,
      disableThinking: true,
    });
    lastRaw = third.content;
    parsed = tryParseVerdict(third.content);
    if (parsed.ok) return parsed;
    lastError = parsed.aiError;
  }

  return {
    ok: false,
    aiError: `AI 输出无法解析为 JSON：${lastError}。可增大 BALANCE_REPORT_AI_MAX_TOKENS，或设 BALANCE_REPORT_DISABLE_THINKING=1 后重试。`,
    rawContent: lastRaw,
  };
}

/** 消费一次 MiniMax 流，返回累积结果 */
async function consumeStream(
  spec: AiAttemptSpec,
  messages: MiniMaxChatMessage[],
  timeoutMs: number,
  callbacks: StreamReportCallbacks | undefined,
): Promise<MiniMaxStreamResult> {
  const stream = chatMiniMaxStreamForJudge(messages, {
    maxCompletionTokens: spec.maxTokens,
    timeoutMs,
    jsonMode: spec.jsonMode,
    disableThinking: spec.disableThinking,
    reasoningSplit: !spec.disableThinking,
  });

  return consumeAll(stream, callbacks);
}

/** 消费整个流，推送 thinking 增量，返回完整结果 */
async function consumeAll(
  generator: AsyncGenerator<MiniMaxStreamChunk, MiniMaxStreamResult>,
  callbacks: StreamReportCallbacks | undefined,
): Promise<MiniMaxStreamResult> {
  const iterator = generator[Symbol.asyncIterator]();
  while (true) {
    const step = await iterator.next();
    if (step.done) {
      return step.value; // MiniMaxStreamResult from chatMiniMaxStream
    }
    const chunk = step.value;
    if (chunk.type === "reasoning") {
      await callbacks?.onThinkingChunk?.(chunk.delta);
    }
  }
}
