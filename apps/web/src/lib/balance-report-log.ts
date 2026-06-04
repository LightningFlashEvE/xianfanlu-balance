const PREFIX = "[仙凡录·平衡报告]";

export function isBalanceReportLogEnabled(): boolean {
  if (process.env.BALANCE_REPORT_LOG === "1") return true;
  if (process.env.BALANCE_REPORT_LOG === "0") return false;
  return process.env.NODE_ENV === "development";
}

export function logBalanceReport(message: string): void {
  if (!isBalanceReportLogEnabled()) return;
  console.log(`${PREFIX} ${message}`);
}

export function logBalanceReportDone(label: string, startedAt: number): void {
  if (!isBalanceReportLogEnabled()) return;
  const ms = Math.round(performance.now() - startedAt);
  console.log(`${PREFIX} ${label} 完成 (${ms}ms)`);
}

export function balanceReportNow(): number {
  return performance.now();
}
