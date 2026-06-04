"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  getBalanceReportCache,
  startBalanceReport,
  type BalanceReportCacheDto,
} from "@/actions/sandbox-balance-report";
import { BalanceReportResultView } from "./balance-report-result-view";

const POLL_MS = 2000;

export function BalanceReportPageClient() {
  const [pending, startTransition] = useTransition();
  const [cache, setCache] = useState<BalanceReportCacheDto | null>(null);
  const [startMessage, setStartMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await getBalanceReportCache();
    setCache(next);
    return next;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (cache?.status !== "running") return;
    const id = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [cache?.status, refresh]);

  const onStart = () => {
    setStartMessage(null);
    startTransition(async () => {
      const res = await startBalanceReport();
      setStartMessage(res.message);
      await refresh();
    });
  };

  const status = cache?.status ?? "idle";

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d7c7aa]/90 bg-[rgba(255,252,245,0.94)] p-4">
        <div>
          <p className="text-sm text-[#6f6559]">
            15 境标准养成扫描 + 装备/功法审计 + 人物/装备数值调整建议 + MiniMax 评审（本地 bot 非 LLM；养成/对手 LLM 代理尚未实现）。
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
        </div>
        <div className="flex flex-wrap gap-2">
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

      {cache?.result && (status === "completed" || status === "failed") && (
        <div className="rounded-lg border border-[#d7c7aa]/90 bg-[rgba(255,252,245,0.94)] p-4">
          <BalanceReportResultView report={cache.result} />
        </div>
      )}
    </div>
  );
}
