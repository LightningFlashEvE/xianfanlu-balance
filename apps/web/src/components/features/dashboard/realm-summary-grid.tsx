import { Card, CardDescription } from "@/components/ui/card";
import { getEvaluatorSummary } from "@/actions/balance";

export async function RealmSummaryGrid() {
  const summary = await getEvaluatorSummary();

  const metrics = [
    { label: "境界最高跨度", value: summary.realmSpan, hint: summary.realmSpanHint },
    { label: "最大相邻跳变", value: summary.maxJump, hint: summary.maxJumpHint },
    { label: "倍率评价", value: summary.realmBalanceGrade, hint: summary.realmBalanceSummary },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-3">
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
