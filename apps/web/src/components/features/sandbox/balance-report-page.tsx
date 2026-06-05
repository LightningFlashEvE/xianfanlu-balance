"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  getBalanceReportCache,
  startBalanceReport,
  resetBalanceReport,
  type BalanceReportCacheDto,
  type BalanceReportTokenUsage,
} from "@/actions/sandbox-balance-report";
import { BalanceReportResultView } from "./balance-report-result-view";

const POLL_MS = 5000; // 5 秒轮询（流式推送已处理 thinking，轮询仅用于 token 进度）
const STALE_RUNNING_MS = 10 * 60 * 1000; // 10 分钟未完成视为卡住

type StreamEventType = "status" | "thinking" | "progress" | "complete" | "error";
type StreamEvent = {
  type?: StreamEventType;
  status?: string;
  text?: string;
  label?: string;
  message?: string;
  grade?: string | null;
  hasAi?: boolean;
  timestamp?: string;
};

export function BalanceReportPageClient() {
  const [pending, startTransition] = useTransition();
  const [cache, setCache] = useState<BalanceReportCacheDto | null>(null);
  const [startMessage, setStartMessage] = useState<string | null>(null);

  // SSE streaming state
  const [thinkingText, setThinkingText] = useState<string>("");
  const [streamingStatus, setStreamingStatus] = useState<
    "idle" | "connecting" | "streaming" | "done" | "error"
  >("idle");
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    const next = await getBalanceReportCache();
    setCache(next);
    return next;
  }, []);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // SSE stream connection
  const connectStream = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setThinkingText("");
    setStreamingStatus("connecting");
    setStreamingError(null);
    setProgressMessages([]);

    try {
      const response = await fetch("/api/balance-report-stream", {
        method: "POST",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`SSE 连接失败 (${response.status})`);
      }

      if (!response.body) {
        throw new Error("SSE 响应无 body");
      }

      setStreamingStatus("streaming");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let thinkingAccumulator = "";

      // SSE 事件缓冲
      let pendingEventType = "message";
      let pendingDataLines: string[] = [];

      const processEvent = (eventType: string, dataLines: string[]) => {
        if (dataLines.length === 0) return;
        const dataStr = dataLines.join("\n");
        try {
          const data = JSON.parse(dataStr) as StreamEvent;

          if (eventType === "thinking" && data.text) {
            thinkingAccumulator += data.text;
            setThinkingText(thinkingAccumulator);
          } else if (eventType === "progress" && data.label) {
            setProgressMessages((prev) => [...prev, data.label!]);
          } else if (eventType === "complete") {
            setStreamingStatus("done");
            void refreshRef.current();
          } else if (eventType === "error" && data.message) {
            setStreamingStatus("error");
            setStreamingError(data.message);
          }
        } catch {
          // 忽略解析错误
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          // 空行 = 事件结束，处理缓冲的事件
          if (line === "" || line === "\r") {
            if (pendingDataLines.length > 0) {
              processEvent(pendingEventType, pendingDataLines);
            }
            pendingEventType = "message";
            pendingDataLines = [];
            continue;
          }

          if (line.startsWith("event:")) {
            pendingEventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            pendingDataLines.push(line.slice(5));
          } else if (line.startsWith(":")) {
            // SSE 注释，忽略
          }
          // 忽略 id:、retry: 等未使用字段
        }
      }

      // 处理最后一个未完成的事件
      if (pendingDataLines.length > 0) {
        processEvent(pendingEventType, pendingDataLines);
      }
    } catch (err) {
      if (controller.signal.aborted) return; // 主动断开，忽略
      const message = err instanceof Error ? err.message : "SSE 连接异常";
      setStreamingStatus("error");
      setStreamingError(message);
    }
  }, []);

  const disconnectStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  useEffect(() => {
    void refreshRef.current();
  }, []);

  // 轮询：仅在流式未活跃时轮询（流式活跃时 SSE 提供实时更新）
  useEffect(() => {
    if (cache?.status !== "running") return;
    // 流式连接活跃时不轮询
    if (streamingStatus === "streaming" || streamingStatus === "connecting") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (!active) return;
      const next = await refreshRef.current();
      if (active && next?.status === "running") {
        timer = setTimeout(tick, POLL_MS);
      }
    };

    timer = setTimeout(tick, POLL_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cache?.status, streamingStatus]);

  // 自动重置卡住的任务
  useEffect(() => {
    if (cache?.status !== "running" || !cache.startedAt) return;
    const elapsed = Date.now() - new Date(cache.startedAt).getTime();
    if (elapsed > STALE_RUNNING_MS) {
      startTransition(async () => {
        await resetBalanceReport();
        await refreshRef.current();
      });
    }
  }, [cache?.status, cache?.startedAt]);

  // 清理
  useEffect(() => {
    return () => {
      disconnectStream();
    };
  }, [disconnectStream]);

  const onStart = () => {
    setStartMessage(null);
    startTransition(async () => {
      const res = await startBalanceReport();
      setStartMessage(res.message);
      await refresh();
      // 启动后台任务后，连接 SSE 获取实时 thinking
      void connectStream();
    });
  };

  const onReset = () => {
    disconnectStream();
    startTransition(async () => {
      await resetBalanceReport();
      setStartMessage("已重置");
      await refresh();
    });
  };

  const status = cache?.status ?? "idle";

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d7c7aa]/90 bg-[rgba(255,252,245,0.94)] p-4">
        <div>
          <p className="text-sm text-[#6f6559]">
            15 境标准养成扫描 + 装备/功法审计 + 规则推导调整建议 + MiniMax AI 评审（本地确定性 bot 模拟对战，AI 仅做评审输出；养成/对手 LLM 代理对战尚未实现）。
            后台生成，可切换页面后返回查看。
          </p>
          {status === "running" && (
            <p className="mt-1 text-sm font-bold text-[#1f7a69]">
              生成中…可去评估器或沙盘，完成后返回本页自动刷新。终端日志前缀：[仙凡录·平衡报告]
            </p>
          )}
          {startMessage && status !== "running" && (
            <p className="mt-1 text-xs text-[#6f6559]">{startMessage}</p>
          )}
          {cache?.startedAt && (
            <p className="mt-1 text-xs text-[#6f6559]">
              开始：{new Date(cache.startedAt).toLocaleString()}
              {cache.completedAt && ` · 完成：${new Date(cache.completedAt).toLocaleString()}`}
            </p>
          )}
          {cache && <TokenUsageSummary usage={cache.tokenUsage} status={status} />}
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "running" && (
            <button
              type="button"
              disabled={pending}
              onClick={onReset}
              className="rounded-md border border-red-400/60 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-60"
            >
              停止
            </button>
          )}
          <button
            type="button"
            disabled={pending || status === "running"}
            onClick={onStart}
            className="rounded-md border border-[#1f7a69]/50 bg-[#1f7a69] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {status === "running" ? "生成中…" : pending ? "提交中…" : "开始生成"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await refresh();
              });
            }}
            className="rounded-md border border-[#d7c7aa] bg-white/80 px-3 py-2 text-sm font-bold text-[#3d3830] disabled:opacity-60"
          >
            刷新状态
          </button>
        </div>
      </div>

      {status === "failed" && cache?.error && (
        <p className="rounded-lg border border-red-300/60 bg-red-50 px-3 py-2 text-sm font-bold text-red-800">
          生成失败：{cache.error}
        </p>
      )}

      {status === "idle" && !cache?.result && (
        <p className="text-sm text-[#6f6559]">尚无报告，点击「开始生成」。</p>
      )}

      {/* Streaming thinking display */}
      {status === "running" && (streamingStatus === "streaming" || streamingStatus === "connecting") && (
        <ThinkingView
          thinkingText={thinkingText}
          progressMessages={progressMessages}
          streamingStatus={streamingStatus}
        />
      )}

      {streamingStatus === "error" && streamingError && (
        <div className="rounded border border-amber-600/40 bg-amber-500/5 p-3">
          <p className="text-xs font-bold text-amber-900">
            流式连接异常（轮询仍在运行）：{streamingError}
          </p>
        </div>
      )}

      {cache?.result && (status === "completed" || status === "failed") && (
        <div className="rounded-lg border border-[#d7c7aa]/90 bg-[rgba(255,252,245,0.94)] p-4">
          <BalanceReportResultView report={cache.result} />
        </div>
      )}
    </div>
  );
}

function ThinkingView({
  thinkingText,
  progressMessages,
  streamingStatus,
}: {
  thinkingText: string;
  progressMessages: string[];
  streamingStatus: "connecting" | "streaming";
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when thinking updates
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [thinkingText, progressMessages]);

  return (
    <div className="rounded-lg border border-[#d7c7aa]/90 bg-[rgba(255,252,245,0.94)] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#1f7a69]" />
        <h3 className="text-sm font-bold text-[#1f7a69]">
          {streamingStatus === "connecting" ? "正在连接 AI…" : "AI 正在思考…"}
        </h3>
      </div>

      {progressMessages.length > 0 && (
        <div className="mb-2 text-xs text-[#6f6559]">
          {progressMessages.map((msg, i) => (
            <div key={i} className="opacity-70">
              → {msg}
            </div>
          ))}
        </div>
      )}

      {thinkingText && (
        <div
          ref={containerRef}
          className="max-h-96 overflow-auto rounded border border-[#d7c7aa]/50 bg-white/70 p-3 text-[12px] leading-relaxed text-[#6f6559] whitespace-pre-wrap break-words"
        >
          {thinkingText}
        </div>
      )}

      {!thinkingText && streamingStatus === "streaming" && (
        <p className="text-sm text-[#6f6559]">等待 AI 响应…</p>
      )}
    </div>
  );
}

function formatTokenCount(value: number) {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.floor(value)));
}

function TokenUsageSummary({
  usage,
  status,
}: {
  usage: BalanceReportTokenUsage;
  status: BalanceReportCacheDto["status"];
}) {
  const hasEstimate = usage.estimatedTokens > 0 || usage.pendingApiCallCount > 0;
  const label = status === "running" ? "实时累计 Token" : "累计 Token";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-md border border-[#1f7a69]/35 bg-[#1f7a69]/10 px-2 py-1 font-extrabold text-[#15584c]">
        {label}{hasEstimate ? "（含估算）" : ""}：{formatTokenCount(usage.totalTokens)}
      </span>
      <span className="text-[#6f6559]">
        输入 {formatTokenCount(usage.promptTokens)} · 输出{" "}
        {formatTokenCount(usage.completionTokens)}
        {usage.reasoningTokens > 0 ? ` · 思考 ${formatTokenCount(usage.reasoningTokens)}` : ""}
        {usage.apiCallCount > 0 ? ` · 响应 ${usage.apiCallCount} 次` : ""}
        {usage.pendingApiCallCount > 0 ? ` · 进行中 ${usage.pendingApiCallCount} 次` : ""}
        {usage.estimatedTokens > 0 ? ` · 估算 ${formatTokenCount(usage.estimatedTokens)}` : ""}
      </span>
      {usage.unavailableCallCount > 0 && (
        <span className="text-amber-900">
          {usage.unavailableCallCount} 次响应未返回 usage
        </span>
      )}
    </div>
  );
}
