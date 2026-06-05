"use client";

import type { ReactNode } from "react";
import type { SandboxBalanceReportResult } from "@/actions/sandbox-balance-report";
import type {
  BalanceAiEquipmentAdjustment,
  BalanceAiHeroAdjustment,
  BalanceRuleFlag,
} from "@xianfanlu/core";
import { formatNumber } from "@xianfanlu/core";

const GRADE_STYLES: Record<string, string> = {
  可发布: "bg-[#1f7a69]/15 text-[#1f7a69] border-[#1f7a69]/40",
  局部风险: "bg-amber-500/15 text-amber-900 border-amber-600/40",
  不建议当前曲线上线: "bg-red-500/15 text-red-900 border-red-600/40",
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "text-red-800",
  warn: "text-amber-900",
  info: "text-[#6f6559]",
};

type Props = {
  report: SandboxBalanceReportResult;
};

function pickHeroAdjustments(report: SandboxBalanceReportResult): {
  items: BalanceAiHeroAdjustment[];
  source: "ai" | "local";
} {
  const hints = report.adjustmentHints?.hero ?? [];
  const ai = report.ai?.heroAdjustments ?? [];
  if (ai.length > 0) return { items: ai, source: "ai" };
  return { items: hints, source: "local" };
}

function pickEquipmentAdjustments(report: SandboxBalanceReportResult): {
  items: BalanceAiEquipmentAdjustment[];
  source: "ai" | "local";
} {
  const hints = report.adjustmentHints?.equipment ?? [];
  const ai = report.ai?.equipmentAdjustments ?? [];
  if (ai.length > 0) return { items: ai, source: "ai" };
  return { items: hints, source: "local" };
}

export function BalanceReportResultView({ report }: Props) {
  const heroAdj = pickHeroAdjustments(report);
  const equipAdj = pickEquipmentAdjustments(report);

  return (
    <div className="grid gap-3">
      {report.error && (
        <p className="text-sm font-bold text-red-800">{report.error}</p>
      )}
      {report.aiError && !report.error && (
        <div className="rounded border border-amber-600/40 bg-amber-500/5 p-3">
          <p className="text-sm font-bold text-amber-900">{report.aiError}</p>
          {report.rawContent && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-[#6f6559] hover:text-[#3d3830]">
                查看 AI 原始返回（{report.rawContent.length} 字符）
              </summary>
              <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap rounded border border-[#d7c7aa]/50 bg-white/70 p-2 text-[11px] leading-relaxed text-[#3d3830]">
                {report.rawContent}
              </pre>
            </details>
          )}
        </div>
      )}

      {report.ai && (
        <section className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md border px-2 py-0.5 text-xs font-bold ${GRADE_STYLES[report.ai.grade] ?? ""}`}
            >
              {report.ai.grade}
            </span>
            <p className="text-sm text-[#3d3830]">{report.ai.summary}</p>
          </div>

          {report.ai.issues.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-bold text-[#6f6559]">问题</h4>
              <ul className="grid gap-1.5 text-sm">
                {report.ai.issues.map((issue, i) => (
                  <li key={i} className="rounded border border-[#d7c7aa]/70 bg-white/60 px-2 py-1.5">
                    <span className="font-bold text-[#3d3830]">
                      [{issue.severity}] {issue.title}
                    </span>
                    <p className="text-xs text-[#6f6559]">{issue.evidence}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.ai.recommendations.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-bold text-[#6f6559]">改进建议</h4>
              <ul className="grid gap-1.5 text-sm">
                {report.ai.recommendations.map((rec, i) => (
                  <li key={i} className="rounded border border-[#1f7a69]/25 bg-[#1f7a69]/5 px-2 py-1.5">
                    <span className="font-bold text-[#1f7a69]">
                      [{rec.priority}] {rec.target}
                    </span>
                    <p className="text-[#3d3830]">{rec.suggestion}</p>
                    <p className="text-xs text-[#6f6559]">预期：{rec.expectedEffect}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {heroAdj.items.length > 0 && (
        <AdjustmentSection
          title="人物数值调整建议"
          source={heroAdj.source}
          children={
            <ul className="grid gap-1.5 text-sm">
              {heroAdj.items.map((row, i) => (
                <li
                  key={i}
                  className="rounded border border-violet-500/25 bg-violet-500/5 px-2 py-1.5"
                >
                  <span className="font-bold text-violet-900">
                    [{row.priority}] {row.target} · {row.field}
                  </span>
                  {row.currentHint && (
                    <p className="text-xs text-[#6f6559]">当前：{row.currentHint}</p>
                  )}
                  <p className="text-[#3d3830]">{row.suggestion}</p>
                  {row.affectedRealms && row.affectedRealms.length > 0 && (
                    <p className="text-xs text-[#6f6559]">关联境界：{row.affectedRealms.join("、")}</p>
                  )}
                  <p className="text-xs text-[#6f6559]">{row.evidence}</p>
                </li>
              ))}
            </ul>
          }
        />
      )}

      {equipAdj.items.length > 0 && (
        <AdjustmentSection
          title="装备数值调整建议"
          source={equipAdj.source}
          children={
            <ul className="grid gap-1.5 text-sm">
              {equipAdj.items.map((row, i) => (
                <li
                  key={i}
                  className="rounded border border-sky-600/25 bg-sky-500/5 px-2 py-1.5"
                >
                  <span className="font-bold text-sky-900">
                    [{row.priority}] {row.itemId}
                    {row.itemName ? ` ${row.itemName}` : ""}
                    {row.balanceRealm ? `（${row.balanceRealm}）` : ""}
                  </span>
                  <p className="text-[#3d3830]">{row.suggestion}</p>
                  {row.affectedRealms && row.affectedRealms.length > 0 && (
                    <p className="text-xs text-[#6f6559]">关联境界：{row.affectedRealms.join("、")}</p>
                  )}
                  <p className="text-xs text-[#6f6559]">{row.evidence}</p>
                </li>
              ))}
            </ul>
          }
        />
      )}

      {!report.ai && (heroAdj.items.length > 0 || equipAdj.items.length > 0) && (
        <p className="text-xs text-[#6f6559]">
          未启用 AI 时，人物/装备建议由本地规则根据守门胜率与养成审计自动生成。
        </p>
      )}

      {report.ruleFlags.length > 0 && (
        <section>
          <h4 className="mb-1 text-xs font-bold text-[#6f6559]">规则预检</h4>
          <ul className="grid gap-1 text-xs">
            {report.ruleFlags.map((flag, i) => (
              <RuleFlagRow key={i} flag={flag} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h4 className="mb-2 text-xs font-bold text-[#6f6559]">数据摘要</h4>
        <BalanceReportDataSummary report={report} />
      </section>
    </div>
  );
}

function AdjustmentSection({
  title,
  source,
  children,
}: {
  title: string;
  source: "ai" | "local";
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h4 className="text-xs font-bold text-[#6f6559]">{title}</h4>
        <span className="rounded border border-[#d7c7aa]/80 px-1.5 py-0.5 text-[10px] font-bold text-[#6f6559]">
          {source === "ai" ? "AI 评审" : "规则推导"}
        </span>
      </div>
      {children}
    </section>
  );
}

function RuleFlagRow({ flag }: { flag: BalanceRuleFlag }) {
  return (
    <li className={SEVERITY_STYLES[flag.severity] ?? ""}>
      <span className="font-bold">[{flag.code}]</span> {flag.evidence}
    </li>
  );
}

function BalanceReportDataSummary({ report }: { report: SandboxBalanceReportResult }) {
  const { payload } = report;
  const cur = payload.sandboxCurrent;
  const auditWithIssues = payload.loadoutAudit.filter((a) => a.issues.length > 0);

  return (
    <div className="grid gap-3 text-xs text-[#6f6559]">
      <p>
        当前沙盘：{cur.attackerRealm} vs {cur.defenderRealm} · 胜率{" "}
        {formatNumber(cur.duel.winChance * 100, 1)}% · 战力差 {formatNumber(cur.duel.powerGap, 2)}x
      </p>

      <div className="overflow-x-auto rounded border border-[#d7c7aa]/50 p-2">
        <p className="mb-2 font-bold text-[#3d3830]">境界轴（标准里程碑养成）</p>
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-[#d7c7aa]/60">
              <th className="pr-2 py-1">境界</th>
              <th>装备</th>
              <th>功法</th>
              <th>战力</th>
              <th>功法占比</th>
              <th>破境胜率</th>
              <th>章节 BOSS</th>
            </tr>
          </thead>
          <tbody>
            {payload.realmSweep.map((row) => (
              <tr key={row.realm} className="border-b border-[#d7c7aa]/30">
                <td className="py-1 pr-2 font-medium text-[#3d3830]">{row.realm}</td>
                <td>{row.equipmentCount}</td>
                <td>{row.manualCount}</td>
                <td>{formatNumber(row.heroPower, 0)}</td>
                <td>{formatNumber(row.manualPowerShare * 100, 0)}%</td>
                <td>
                  {row.vsNextGate
                    ? `${formatNumber(row.vsNextGate.duel.winChance * 100, 1)}% → ${row.vsNextGate.nextRealm}`
                    : "—"}
                </td>
                <td>
                  {row.vsBandPreset
                    ? `${formatNumber(row.vsBandPreset.duel.winChance * 100, 1)}% (${row.vsBandPreset.presetLabel})`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {auditWithIssues.length > 0 && (
        <div className="rounded border border-amber-600/30 bg-amber-500/5 p-2">
          <p className="mb-1 font-bold text-amber-900">养成审计（有问题境界）</p>
          <ul className="grid gap-1">
            {auditWithIssues.map((a) => (
              <li key={a.realm}>
                <span className="font-bold text-[#3d3830]">{a.realm}</span>：{a.issues.join("、")}（
                {a.wearSlotFill} 栏 / {a.manualCount} 功法 / 库 {a.libraryItemsInBand} 件）
              </li>
            ))}
          </ul>
        </div>
      )}

      {payload.botStrategies.map((bot) => (
        <div key={bot.id} className="rounded border border-[#d7c7aa]/50 p-2">
          <p className="font-bold text-[#3d3830]">
            {bot.label}（当前境界 · {bot.heroEquipmentCount} 装 / {bot.enabledManualCount} 功法）
          </p>
          <table className="mt-1 w-full text-left">
            <thead>
              <tr>
                <th className="pr-2">对手</th>
                <th>胜率</th>
                <th>战力差</th>
              </tr>
            </thead>
            <tbody>
              {bot.matches.map((m, i) => (
                <tr key={i}>
                  <td className="pr-2">
                    {m.kind === "preset" ? m.presetLabel : "当前守方"}（{m.defenderRealm}）
                  </td>
                  <td>{formatNumber(m.duel.winChance * 100, 1)}%</td>
                  <td>{formatNumber(m.duel.powerGap, 2)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
