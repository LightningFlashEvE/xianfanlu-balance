import { getProgressionChartData } from "@/actions/balance";
import { ProgressionCurveChart } from "@/components/features/charts/progression-curve-chart";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { CurveInsights } from "./curve-insights";
export async function ChartPanel() {
  const chart = await getProgressionChartData();

  return (
    <Card>
      <CardDescription>Balance View</CardDescription>
      <CardTitle className="mb-1">进度轴战力对比</CardTitle>
      <p className="mb-3 text-xs text-[#6f6559]">
        绿线：各境界标准养成主角战力；灰虚线：同阶镜像敌人；红虚线：独立破境守门模板。用于观察区间强度与跨阶崩坏，而非单纯境界倍率。
      </p>
      <ProgressionCurveChart
        points={chart.points.map((p) => ({
          realm: p.realm,
          heroPower: p.heroPower,
          mirrorEnemyPower: p.mirrorEnemyPower,
          nextGatePower: p.nextGatePower,
        }))}
        heroRealm={chart.heroRealm}
      />
      <CurveInsights
        progression={chart.analysis}
        realmCurve={chart.realmCurve}
        crossRealmRisks={chart.crossRealmRisks}
        heroRealm={chart.heroRealm}
        heroPoint={chart.points.find((p) => p.realm === chart.heroRealm)}
      />
    </Card>
  );
}
