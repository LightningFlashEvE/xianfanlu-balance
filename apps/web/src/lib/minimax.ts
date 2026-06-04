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

export type MiniMaxChatResult = {
  content: string;
  finishReason: string;
};

type MiniMaxChoiceMessage = {
  content?: string | null;
  reasoning_content?: string | null;
  reasoning_details?: Array<{ text?: string | null }> | null;
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
  return { content, finishReason };
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

function parseEnvPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
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
  const trimmed = stripModelThinking(text);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const candidates: string[] = [];
  for (let i = 0; i < trimmed.length; i += 1) {
    if (trimmed[i] !== "{") continue;
    const obj = extractBalancedJsonAt(trimmed, i);
    if (obj) candidates.push(obj);
  }

  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const candidate = candidates[i]!;
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && "grade" in parsed) {
        return candidate;
      }
    } catch {
      /* try older candidate */
    }
  }

  if (candidates.length > 0) return candidates[candidates.length - 1]!;

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
    lower.includes("提取结果为空")
  );
}

/** 解析平衡报告 AI 评审 JSON */
export function parseBalanceAiRawContent(rawContent: string): unknown {
  const jsonText = extractJsonObject(rawContent);
  if (!jsonText.trim()) {
    throw new Error("提取结果为空");
  }
  return JSON.parse(jsonText);
}
