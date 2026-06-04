import { Card, CardDescription } from "@/components/ui/card";
import { getEvaluatorSummary } from "@/actions/balance";

export async function ProgressionSummaryGrid() {
  const summary = await getEvaluatorSummary();

  const metrics = [
    { label: "主角总评战力", value: summary.powerScore, hint: summary.powerHint },
    { label: "进度轴评价", value: summary.balanceGrade, hint: summary.balanceSummary },
    { label: "综合修炼速度", value: summary.cultivationSpeed, hint: summary.cultivationHint },
    { label: "突破修正", value: summary.breakthrough, hint: summary.breakthroughHint },
    { label: "机缘修正", value: summary.opportunity, hint: summary.opportunityHint },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {metrics.map((metric) => (
        <Card key={metric.label} className="grid min-h-[100px] gap-1">
          <CardDescription>{metric.label}</CardDescription>
          <p className="text-2xl font-bold leading-tight">{metric.value}</p>
          <p className="text-xs text-[#6f6559]">{metric.hint}</p>
        </Card>
      ))}
    </section>
  );
}
