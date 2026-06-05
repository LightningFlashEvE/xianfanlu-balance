export const dynamic = "force-dynamic";

import { RealmTableSection } from "@/components/features/dashboard/realm-table-section";
import { ProgressionChartsSection } from "@/components/features/dashboard/progression-charts-section";
import { HeroBreakdownPanel } from "@/components/features/dashboard/hero-breakdown-panel";
import { HeroEditorSection } from "@/components/features/dashboard/hero-editor-section";
import { EvaluatorToolbar } from "@/components/features/dashboard/evaluator-toolbar";
import { BalanceLayerHeading } from "@/components/features/dashboard/balance-layer-heading";
import { RealmSummaryGrid } from "@/components/features/dashboard/realm-summary-grid";
import { ProgressionSummaryGrid } from "@/components/features/dashboard/progression-summary-grid";

export default function HomePage() {
  return (
    <>
      <EvaluatorToolbar />
      <BalanceLayerHeading
        layer="realm"
        title="宏观 · 境界倍率轴"
        description="只看各境界 multiplier 的跨度与跳变，判断大境界是否过陡或过平；不代入装备与敌人。"
      />
      <RealmSummaryGrid />
      <RealmTableSection />
      <BalanceLayerHeading
        layer="progression"
        title="进度 · 标准养成轴"
        description="按装备合理大境界段与功法累计上限，对比同阶镜像与独立破境守门模板，观察区间强度与跨阶风险。"
      />
      <ProgressionSummaryGrid />
      <ProgressionChartsSection />
      <HeroEditorSection />
      <HeroBreakdownPanel />
    </>
  );
}
