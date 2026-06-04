import { calculateRatedPower } from "@xianfanlu/core";
import { loadBalanceState } from "@/actions/state";
import { getMilestoneEvaluation } from "@/lib/milestone-eval";
import { RadarChart } from "@/components/features/charts/radar-chart";
import { buildRadarAxes } from "@/lib/chart-draw";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@xianfanlu/core";

export async function HeroBreakdownPanel() {
  const state = await loadBalanceState();
  const realm = state.realms.find((r) => r.name === state.heroRealm) ?? state.realms[0]!;
  const { context, contextWithoutManuals, equipmentIds, milestoneManuals } =
    getMilestoneEvaluation(state);
  const breakdown = calculateRatedPower({
    stats: context.stats,
    realmMultiplier: realm.multiplier,
    potentialMultiplier: state.combatMultiplier,
    options: { statsWithoutManuals: contextWithoutManuals.stats },
  });
  const realmScale = Math.sqrt(Math.max(realm.multiplier, 0.01));
  const radarAxes = buildRadarAxes(context.stats);

  const rows: [string, string][] = [
    ["基础战斗", formatNumber(breakdown.base, 1)],
    ["武攻 DPS", formatNumber(breakdown.martialDps, 2)],
    ["生存", formatNumber(breakdown.durability, 1)],
    ["资源", formatNumber(breakdown.resource, 1)],
    ["术法", formatNumber(breakdown.mystic, 1)],
    ["标准养成", `${equipmentIds.length} 装 / ${milestoneManuals.length} 功法`],
    ["等级系数", `${formatNumber(breakdown.levelFactor, 2)}x`],
    ["境界缩放", `${formatNumber(realmScale, 2)}x（√${formatNumber(realm.multiplier, 0)}）`],
    ["功法贡献", formatNumber(breakdown.manualContribution, 1)],
  ];

  return (
    <Card>
      <CardDescription>Hero Base</CardDescription>
      <CardTitle className="mb-3">主角属性与拆分</CardTitle>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <RadarChart axes={radarAxes} />
        <div className="rounded-lg border border-[#d7c7aa]/80 bg-[rgba(255,250,240,0.7)] p-3">
          <h3 className="mb-2 text-sm font-bold">当前拆分</h3>
          <dl className="grid grid-cols-[1fr_auto] gap-2 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-[#6f6559]">{label}</dt>
                <dd className="font-extrabold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Card>
  );
}
