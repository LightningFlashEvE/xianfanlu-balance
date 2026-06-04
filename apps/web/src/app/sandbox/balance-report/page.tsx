export const dynamic = "force-dynamic";

import Link from "next/link";
import { BalanceReportPageClient } from "@/components/features/sandbox/balance-report-page";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function SandboxBalanceReportPage() {
  return (
    <>
      <Card className="border-[#d7c7aa]/80 bg-[rgba(255,250,240,0.55)]">
        <CardDescription>Balance Report</CardDescription>
        <CardTitle className="mb-1">AI 平衡报告</CardTitle>
        <p className="text-sm text-[#6f6559]">
          逐境界标准养成守门、章节 BOSS 与养成审计；结果仅保留最新一份。
          <Link href="/sandbox" className="ml-2 font-bold text-[#1f7a69] underline">
            返回对战沙盘
          </Link>
        </p>
      </Card>
      <BalanceReportPageClient />
    </>
  );
}
