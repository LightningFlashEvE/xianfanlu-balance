import {
  balanceReportNow,
  logBalanceReport,
  logBalanceReportDone,
} from "@/lib/balance-report-log";

const REGION_BASE_URL: Record<string, string> = {
  international: "https://api.minimax.io/v1",
  china: "https://api.minimaxi.com/v1",
};

const DEFAULT_BASE_URL = REGION_BASE_URL.international!;
const DEFAULT_MODEL = "MiniMax-M3";
const DEFAULT_TIMEOUT_MS = 180_000;

function resolveDefaultTimeoutMs(): number {
  const raw = process.env.MINIMAX_REQUEST_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_TIMEOUT_MS;
}

export type MiniMaxChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type MiniMaxChatOptions = {
  temperature?: number;
  maxCompletionTokens?: number;
  timeoutMs?: number;
  jsonMode?: boolean;
  disableThinking?: boolean;
  reasoningSplit?: boolean;
};

export type MiniMaxTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens: number;
};

export type MiniMaxChatResult = {
  content: string;
  finishReason: string;
  usage: MiniMaxTokenUsage | null;
};

/** SSE 流式 chunk 类型 */
export type MiniMaxStreamChunk =
  | { type: "reasoning"; delta: string }
  | { type: "content"; delta: string }
  | { type: "done"; finishReason: string; usage: MiniMaxTokenUsage | null };

/** 流式结果（累积完整内容） */
export type MiniMaxStreamResult = {
  content: string;
  reasoningContent: string;
  finishReason: string;
  usage: MiniMaxTokenUsage | null;
};

type MiniMaxChoiceMessage = {
  content?: string | null;
  reasoning_content?: string | null;
  reasoning_details?: Array<{ text?: string | null }> | null;
};

type MiniMaxApiUsage = {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  reasoning_tokens?: number | null;
  reasoningTokens?: number | null;
  completion_tokens_details?: {
    reasoning_tokens?: number | null;
  } | null;
};

function normalizeApiKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim();
  }
  return trimmed;
}

export function resolveMiniMaxBaseUrl(): string {
  const explicit = process.env.MINIMAX_API_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const region = process.env.MINIMAX_REGION?.trim().toLowerCase();
  if (region && REGION_BASE_URL[region]) {
    return REGION_BASE_URL[region]!;
  }
  return DEFAULT_BASE_URL;
}

function buildChatCompletionsUrl(baseUrl: string): string {
  const url = new URL(`${baseUrl}/chat/completions`);
  const groupId = process.env.MINIMAX_GROUP_ID?.trim();
  if (groupId) {
    url.searchParams.set("GroupId", groupId);
  }
  return url.toString();
}

function authHintFor401(key: string): string {
  const hints: string[] = [];
  if (key.startsWith("ey")) {
    hints.push(
      "当前 Key 形如 JWT（ey 开头），OpenAI 兼容接口需要控制台「API Keys → Create New Secret Key」生成的 sk- 密钥",
    );
  }
  hints.push(
    "确认 MINIMAX_REGION 与开户站点一致：国际 platform.minimax.io 用 international（默认），国内 platform.minimaxi.com 用 china",
  );
  hints.push("Coding Plan 订阅密钥与按量 Standard 密钥不可混用端点");
  if (!process.env.MINIMAX_GROUP_ID?.trim()) {
    hints.push("国内账号若仍 401，可在 .env 增加 MINIMAX_GROUP_ID=个人中心里的 19 位 Group ID");
  }
  return hints.join("；");
}

export async function chatMiniMax(
  messages: MiniMaxChatMessage[],
  options?: MiniMaxChatOptions,
): Promise<MiniMaxChatResult> {
  const apiKey = normalizeApiKey(process.env.MINIMAX_API_KEY ?? "");
  if (!apiKey) {
    throw new Error("未配置 MINIMAX_API_KEY");
  }

  const baseUrl = resolveMiniMaxBaseUrl();
  const model = process.env.MINIMAX_MODEL?.trim() || DEFAULT_MODEL;
  const requestUrl = buildChatCompletionsUrl(baseUrl);
  const timeoutMs = options?.timeoutMs ?? resolveDefaultTimeoutMs();
  const region = process.env.MINIMAX_REGION?.trim() || "international";
  const maxTokens = options?.maxCompletionTokens ?? 4096;

  logBalanceReport(
    `MiniMax fetch 开始 model=${model} region=${region} max_tokens=${maxTokens} json=${!!options?.jsonMode} think_off=${!!options?.disableThinking}`,
  );
  const fetchStart = balanceReportNow();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(requestUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.3,
        max_completion_tokens: maxTokens,
        ...(options?.jsonMode ? { response_format: { type: "json_object" } } : {}),
        extra_body: {
          ...(options?.reasoningSplit !== false
            ? { reasoning_split: true }
            : {}),
          ...(options?.disableThinking ? { thinking: { type: "disabled" } } : {}),
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      logBalanceReport(`MiniMax 请求超时（>${timeoutMs}ms）`);
      throw new Error(`MiniMax 请求超时（${timeoutMs / 1000} 秒），请稍后重试或缩小报告数据`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  logBalanceReportDone(`MiniMax HTTP ${res.status}`, fetchStart);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new Error(
        `MiniMax 认证失败 (401)：${text.slice(0, 300)}。排查：${authHintFor401(apiKey)}`,
      );
    }
    throw new Error(`MiniMax API ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: MiniMaxChoiceMessage; finish_reason?: string }[];
    usage?: MiniMaxApiUsage | null;
    error?: { message?: string };
    base_resp?: { status_code?: number; status_msg?: string };
  };

  if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
    const code = data.base_resp.status_code;
    const msg = data.base_resp.status_msg ?? "unknown";
    if (code === 2049) {
      throw new Error(`MiniMax invalid api key (2049)：${msg}。排查：${authHintFor401(apiKey)}`);
    }
    throw new Error(`MiniMax base_resp ${code}: ${msg}`);
  }

  if (data.error?.message) {
    throw new Error(data.error.message);
  }

  const choice = data.choices?.[0];
  const content = resolveAssistantContent(choice?.message);
  const finishReason = choice?.finish_reason ?? "unknown";
  logBalanceReport(
    `MiniMax 正文 ${content.length} 字符 finish_reason=${finishReason}`,
  );
  if (!content) {
    throw new Error(
      "MiniMax 返回空正文（可能被 thinking 占满 token，请增大 BALANCE_REPORT_AI_MAX_TOKENS）",
    );
  }
  return { content, finishReason, usage: normalizeMiniMaxUsage(data.usage) };
}

/** 平衡报告评审：json + reasoning_split，默认保留思考 */
export function chatMiniMaxForJudge(
  messages: MiniMaxChatMessage[],
  overrides?: Partial<MiniMaxChatOptions>,
): Promise<MiniMaxChatResult> {
  return chatMiniMax(messages, {
    temperature: 0.2,
    jsonMode: true,
    reasoningSplit: true,
    disableThinking: false,
    ...overrides,
  });
}

/** 未来沙盘养成/对手代理：默认更高 token、保留思考 */
export function chatMiniMaxForAgent(
  messages: MiniMaxChatMessage[],
  overrides?: Partial<MiniMaxChatOptions>,
): Promise<MiniMaxChatResult> {
  const maxTokens = parseEnvPositiveInt(process.env.SANDBOX_AGENT_MAX_TOKENS, 8192);
  return chatMiniMax(messages, {
    temperature: 0.3,
    maxCompletionTokens: maxTokens,
    jsonMode: true,
    reasoningSplit: true,
    disableThinking: false,
    ...overrides,
  });
}

/** MiniMax SSE 流式 delta 字段 */
type MiniMaxStreamDelta = {
  content?: string | null;
  reasoning_content?: string | null;
  role?: string;
};

type MiniMaxStreamChoice = {
  delta?: MiniMaxStreamDelta;
  finish_reason?: string | null;
  index?: number;
};

type MiniMaxStreamChunkResponse = {
  id?: string;
  choices?: MiniMaxStreamChoice[];
  usage?: MiniMaxApiUsage | null;
  error?: { message?: string };
};

/**
 * MiniMax SSE 流式对话。
 *
 * 返回 `AsyncIterable<MiniMaxStreamChunk>`，每次 yield 一个 reasoning 或 content 增量，
 * 流结束时 yield `done` chunk。同时返回累积的 `MiniMaxStreamResult`。
 *
 * 使用方式：
 * ```ts
 * const stream = chatMiniMaxStream(messages, options);
 * for await (const chunk of stream) {
 *   if (chunk.type === "reasoning") console.log(chunk.delta);
 * }
 * // result 包含完整内容
 * ```
 */
export async function* chatMiniMaxStream(
  messages: MiniMaxChatMessage[],
  options?: MiniMaxChatOptions,
): AsyncGenerator<MiniMaxStreamChunk, MiniMaxStreamResult> {
  const apiKey = normalizeApiKey(process.env.MINIMAX_API_KEY ?? "");
  if (!apiKey) {
    throw new Error("未配置 MINIMAX_API_KEY");
  }

  const baseUrl = resolveMiniMaxBaseUrl();
  const model = process.env.MINIMAX_MODEL?.trim() || DEFAULT_MODEL;
  const requestUrl = buildChatCompletionsUrl(baseUrl);
  const timeoutMs = options?.timeoutMs ?? resolveDefaultTimeoutMs();
  const region = process.env.MINIMAX_REGION?.trim() || "international";
  const maxTokens = options?.maxCompletionTokens ?? 4096;

  // 流式日志已静音（网页实时显示思考内容）
  const fetchStart = balanceReportNow();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(requestUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: options?.temperature ?? 0.3,
        max_completion_tokens: maxTokens,
        ...(options?.jsonMode ? { response_format: { type: "json_object" } } : {}),
        extra_body: {
          ...(options?.reasoningSplit !== false
            ? { reasoning_split: true }
            : {}),
          ...(options?.disableThinking ? { thinking: { type: "disabled" } } : {}),
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      logBalanceReport(`MiniMax stream 请求超时（>${timeoutMs}ms）`);
      throw new Error(`MiniMax 请求超时（${timeoutMs / 1000} 秒），请稍后重试或缩小报告数据`);
    }
    throw err;
  }

  clearTimeout(timeoutId);
  // HTTP 状态日志已静音

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new Error(
        `MiniMax 认证失败 (401)：${text.slice(0, 300)}。排查：${authHintFor401(apiKey)}`,
      );
    }
    throw new Error(`MiniMax API ${res.status}: ${text.slice(0, 500)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("MiniMax stream 响应无 body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoningContent = "";
  let finishReason = "unknown";
  let usage: MiniMaxTokenUsage | null = null;
  let chunkCount = 0;

  // MiniMax M3 把 thinking 放在 content 里用 <think> 标签包裹
  // 需要状态机来分离 thinking 和 content
  let inThinkBlock = false;
  let thinkTagBuffer = ""; // 可能包含不完整的 <think> 或 </think> 标签

  try {
    while (true) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue; // SSE 注释
        if (!trimmed.startsWith("data:")) continue;

        const dataStr = trimmed.slice(5).trim();
        if (dataStr === "[DONE]") {
          finishReason = "stop";
          break;
        }

        try {
          const parsed = JSON.parse(dataStr) as MiniMaxStreamChunkResponse;

          // 处理错误
          if (parsed.error?.message) {
            throw new Error(parsed.error.message);
          }

          const choice = parsed.choices?.[0];
          if (!choice?.delta) continue;

          // 处理 reasoning_content（MiniMax 标准字段）
          if (choice.delta.reasoning_content) {
            const rc = choice.delta.reasoning_content;
            reasoningContent += rc;
            chunkCount++;
            yield { type: "reasoning", delta: rc };
          }

          // 处理 content（可能包含 <think> 标签）
          if (choice.delta.content) {
            const rawContent = choice.delta.content;
            chunkCount++;

            // 使用状态机解析 <think> 标签
            const result = parseThinkTagContent(
              thinkTagBuffer + rawContent,
              inThinkBlock,
            );

            if (result.thinking) {
              reasoningContent += result.thinking;
              yield { type: "reasoning", delta: result.thinking };
            }
            if (result.content) {
              content += result.content;
              yield { type: "content", delta: result.content };
            }

            inThinkBlock = result.inThinkBlock;
            thinkTagBuffer = result.remainder;
          }

          // 处理 finish_reason
          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
          }

          // 最后一个 chunk 可能携带 usage
          if (parsed.usage) {
            usage = normalizeMiniMaxUsage(parsed.usage);
          }
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message.includes("未配置")) {
            throw parseErr;
          }
          // 忽略解析错误（可能是格式不完整的 JSON）
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // 流结束日志已静音（网页实时显示思考内容）

  // yield done chunk
  yield { type: "done", finishReason, usage };

  return { content, reasoningContent, finishReason, usage };
}

/** 平衡报告流式评审：json + reasoning_split，默认保留思考 */
export function chatMiniMaxStreamForJudge(
  messages: MiniMaxChatMessage[],
  overrides?: Partial<MiniMaxChatOptions>,
): AsyncGenerator<MiniMaxStreamChunk, MiniMaxStreamResult> {
  return chatMiniMaxStream(messages, {
    temperature: 0.2,
    jsonMode: true,
    reasoningSplit: true,
    disableThinking: false,
    ...overrides,
  });
}

function parseEnvPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function apiUsageNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizeMiniMaxUsage(usage: MiniMaxApiUsage | null | undefined): MiniMaxTokenUsage | null {
  if (!usage || typeof usage !== "object") return null;
  const promptTokens = apiUsageNumber(usage.prompt_tokens ?? usage.promptTokens);
  const completionTokens = apiUsageNumber(usage.completion_tokens ?? usage.completionTokens);
  const explicitTotal = apiUsageNumber(usage.total_tokens ?? usage.totalTokens);
  const reasoningTokens = apiUsageNumber(
    usage.reasoning_tokens ??
      usage.reasoningTokens ??
      usage.completion_tokens_details?.reasoning_tokens,
  );
  const totalTokens =
    explicitTotal > 0
      ? explicitTotal
      : completionTokens > 0
        ? promptTokens + completionTokens
        : promptTokens + reasoningTokens;
  if (promptTokens + completionTokens + reasoningTokens + totalTokens <= 0) return null;
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    reasoningTokens,
  };
}

function resolveAssistantContent(message: MiniMaxChoiceMessage | undefined): string {
  if (!message) return "";
  const content = typeof message.content === "string" ? message.content.trim() : "";
  if (content) return content;
  return "";
}

function thinkBlockPattern(open: string, close: string): RegExp {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${esc(open)}[\\s\\S]*?${esc(close)}`, "gi");
}

/**
 * 解析包含 <think> 标签的流式内容片段。
 * 返回提取的 thinking 和 content，以及剩余未处理的文本（可能包含不完整的标签）。
 */
function parseThinkTagContent(
  text: string,
  inThinkBlock: boolean,
): { thinking: string; content: string; remainder: string; inThinkBlock: boolean } {
  let thinking = "";
  let content = "";
  let remainder = "";
  let remaining = text;
  let currentInThink = inThinkBlock;

  const openTag = "<think>";
  const closeTag = "</think>";

  while (remaining.length > 0) {
    if (currentInThink) {
      // 在 think 块内，寻找 </think>
      const closeIdx = remaining.toLowerCase().indexOf(closeTag);
      if (closeIdx >= 0) {
        // 找到结束标签
        thinking += remaining.slice(0, closeIdx);
        remaining = remaining.slice(closeIdx + closeTag.length);
        currentInThink = false;
      } else {
        // 未找到结束标签，可能标签不完整
        // 检查是否以 "<" 或 "<" 结尾
        const lowerText = remaining.toLowerCase();
        if (lowerText.endsWith("\x3C") || lowerText.endsWith("\x3C/")) {
          thinking += remaining;
          remaining = "";
        } else {
          // 保留最后可能是不完整标签的部分
          const lastLt = remaining.lastIndexOf("\x3C");
          if (lastLt >= 0 && remaining.slice(lastLt).toLowerCase().startsWith("\x3C/")) {
            thinking += remaining.slice(0, lastLt);
            remainder = remaining.slice(lastLt);
            remaining = "";
          } else {
            thinking += remaining;
            remaining = "";
          }
        }
      }
    } else {
      // 不在 think 块内，寻找 <think>
      const openIdx = remaining.toLowerCase().indexOf(openTag);
      if (openIdx >= 0) {
        // 找到开始标签
        content += remaining.slice(0, openIdx);
        remaining = remaining.slice(openIdx + openTag.length);
        currentInThink = true;
      } else {
        // 未找到开始标签，可能标签不完整
        // 检查是否以 "<" 结尾
        if (remaining.toLowerCase().endsWith("\x3C")) {
          content += remaining;
          remaining = "";
        } else {
          // 保留最后可能是不完整标签的部分
          const lastLt = remaining.lastIndexOf("\x3C");
          if (lastLt >= 0 && remaining.slice(lastLt).toLowerCase().startsWith("\x3Cthink")) {
            content += remaining.slice(0, lastLt);
            remainder = remaining.slice(lastLt);
            remaining = "";
          } else {
            content += remaining;
            remaining = "";
          }
        }
      }
    }
  }

  return { thinking, content, remainder, inThinkBlock: currentInThink };
}

const THINKING_TAG_PATTERNS = [
  thinkBlockPattern("<" + "think>", "</" + "think>"),
  thinkBlockPattern("<thinking>", "</thinking>"),
  thinkBlockPattern("<think>", "</think>"),
];

/** 去掉 MiniMax M3 等模型附带的 reasoning / thinking 块 */
export function stripModelThinking(text: string): string {
  let out = text.trim();
  for (const pattern of THINKING_TAG_PATTERNS) {
    out = out.replace(pattern, "");
  }
  out = out.trim();
  const brace = out.indexOf("{");
  if (brace > 0 && out.slice(0, brace).includes("<")) {
    out = out.slice(brace);
  }
  return out.trim();
}

function extractBalancedJsonAt(text: string, start: number): string | null {
  if (text[start] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** 从模型输出中提取 JSON 对象（跳过 thinking，优先含 grade 的评审对象） */
export function extractJsonObject(text: string): string {
  // 策略 A：找到 </think>，然后取其后第一个 { 到最后一个 } 之间的文本
  // 这是最可靠的策略，因为 thinking 块内可能包含大量 JSON 示例干扰提取
  const thinkEndTag = "<" + "/think>";
  const thinkEndIdx = text.toLowerCase().indexOf(thinkEndTag);
  if (thinkEndIdx >= 0) {
    const afterThink = text.slice(thinkEndIdx + thinkEndTag.length).trim();
    if (afterThink.length > 0) {
      const start = afterThink.indexOf("{");
      const end = afterThink.lastIndexOf("}");
      if (start >= 0 && end > start) {
        const candidate = afterThink.slice(start, end + 1);
        try {
          const parsed = JSON.parse(candidate) as Record<string, unknown>;
          if (parsed && typeof parsed === "object") {
            return candidate;
          }
        } catch {
          // 如果首尾括号提取失败（可能 JSON 被截断），尝试 brace-matching
          const balanced = extractBalancedJsonAt(afterThink, start);
          if (balanced) {
            try {
              const parsed = JSON.parse(balanced) as Record<string, unknown>;
              if (parsed && typeof parsed === "object") return balanced;
            } catch {
              /* 继续其他策略 */
            }
          }
        }
      }
    }
  }

  // 策略 B：strip thinking 后，找最后一个含 grade 的完整 JSON
  const trimmed = stripModelThinking(text);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  // 收集所有平衡的 JSON 候选
  const candidates: string[] = [];
  for (let i = 0; i < trimmed.length; i += 1) {
    if (trimmed[i] !== "{") continue;
    const obj = extractBalancedJsonAt(trimmed, i);
    if (obj) candidates.push(obj);
  }

  // 优先返回含 grade 的候选（从后往前，最新的优先）
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const candidate = candidates[i]!;
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && "grade" in parsed) {
        return candidate;
      }
    } catch {
      /* 继续找下一个 */
    }
  }

  if (candidates.length > 0) return candidates[candidates.length - 1]!;

  // 最后尝试：首尾括号
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);

  throw new Error("未在模型输出中找到完整 JSON 对象");
}

export function isLikelyTruncatedJsonError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("unexpected end of json") ||
    lower.includes("未在模型输出中找到") ||
    lower.includes("提取结果为空") ||
    // Zod: 字段缺失通常是因为输出被截断（如 heroAdjustments[0].priority 为 undefined）
    lower.includes("\"code\":\"invalid_type\"") ||
    lower.includes("\"code\": \"invalid_type\"") ||
    (lower.includes("required") && lower.includes("invalid_type"))
  );
}

/** 解析平衡报告 AI 评审 JSON */
export function parseBalanceAiRawContent(rawContent: string): unknown {
  let jsonText: string;
  try {
    jsonText = extractJsonObject(rawContent);
  } catch (firstErr) {
    // 兜底：直接从 </think> 之后提取
    const thinkEndIdx = rawContent.search(/<\/think>/i);
    if (thinkEndIdx >= 0) {
      const afterThink = rawContent.slice(thinkEndIdx).replace(/<\/think>/i, "").trim();
      const afterStart = afterThink.indexOf("{");
      const afterEnd = afterThink.lastIndexOf("}");
      if (afterStart >= 0 && afterEnd > afterStart) {
        jsonText = afterThink.slice(afterStart, afterEnd + 1);
      } else {
        throw firstErr;
      }
    } else {
      throw firstErr;
    }
  }

  if (!jsonText.trim()) {
    throw new Error("提取结果为空");
  }

  const parsed = JSON.parse(jsonText);

  // 如果关键字段缺失，尝试兜底提取
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const hasGrade = "grade" in obj;
    const hasSummary = "summary" in obj;
    if (!hasGrade || !hasSummary) {
      // 从 </think> 之后重新提取
      const thinkEndIdx = rawContent.search(/<\/think>/i);
      if (thinkEndIdx >= 0) {
        const afterThink = rawContent.slice(thinkEndIdx).replace(/<\/think>/i, "").trim();
        for (let i = 0; i < afterThink.length; i += 1) {
          if (afterThink[i] !== "{") continue;
          const candidate = extractBalancedJsonAt(afterThink, i);
          if (candidate) {
            try {
              const retry = JSON.parse(candidate) as Record<string, unknown>;
              if (retry && typeof retry === "object" && "grade" in retry && "summary" in retry) {
                return retry;
              }
            } catch {
              /* 继续找下一个 */
            }
          }
        }
      }
      // 仍然缺失，记录警告
      const preview = jsonText.length > 200 ? jsonText.slice(0, 200) + "..." : jsonText;
      console.warn(`[仙凡录·平衡报告] 提取的 JSON 缺少关键字段 (grade=${hasGrade}, summary=${hasSummary}): ${preview}`);
    }
  }

  return parsed;
}
