import { getProgressionChartData } from "@/actions/balance";
import { loadBalanceState } from "@/actions/state";
import { ProgressionCurveChart } from "@/components/features/charts/progression-curve-chart";
import { CultivationCurveChart } from "@/components/features/charts/cultivation-curve-chart";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { CurveInsights } from "./curve-insights";
import { formatNumber } from "@xianfanlu/core";

export async function ProgressionChartsSection() {
  const [chart, state] = await Promise.all([getProgressionChartData(), loadBalanceState()]);

  const speeds = chart.points.map((p) => p.cultivationSpeed);
  const minSpeed = speeds.length ? Math.min(...speeds) : 0;
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardDescription>Combat Benchmark</CardDescription>
          <CardTitle className="mb-1">战力对比曲线</CardTitle>
          <p className="mb-3 text-xs text-[#6f6559]">
            绿线：标准养成主角战力；灰虚线：同阶镜像；红虚线：下境界守门。
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
        </Card>
        <Card>
          <CardDescription>Cultivation Axis</CardDescription>
          <CardTitle className="mb-1">养成轴 · 修炼速度</CardTitle>
          <p className="mb-3 text-xs text-[#6f6559]">
            按各境界标准养成（含当前灵根品相）计算综合修炼速度；灵根越少曲线越高。
          </p>
          <CultivationCurveChart
            points={chart.points.map((p) => ({
              realm: p.realm,
              cultivationSpeed: p.cultivationSpeed,
              breakthroughBonus: p.breakthroughBonus,
            }))}
            heroRealm={chart.heroRealm}
          />
        </Card>
      </div>
      <CurveInsights
        progression={chart.analysis}
        realmCurve={chart.realmCurve}
        crossRealmRisks={chart.crossRealmRisks}
        heroRealm={chart.heroRealm}
        heroPoint={chart.points.find((p) => p.realm === chart.heroRealm)}
        spiritualRootLabel={state.aptitude.spiritualRoot}
        cultivationRange={`${formatNumber(minSpeed, 0)}% ~ ${formatNumber(maxSpeed, 0)}%`}
      />
    </div>
  );
}
