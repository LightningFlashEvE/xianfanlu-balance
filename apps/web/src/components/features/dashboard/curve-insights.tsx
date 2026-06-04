import type { CrossRealmRisk, ProgressionPoint } from "@xianfanlu/core";
import { formatNumber } from "@xianfanlu/core";

type RealmCurveAnalysis = {
  grade: string;
  summary: string;
  span: number;
  maxJump: { from: string; to: string; jump: number };
};

type ProgressionAnalysis = {
  grade: string;
  summary: string;
  weakGates: string[];
  worstGate: string | null;
};

type Props = {
  progression: ProgressionAnalysis;
  realmCurve: RealmCurveAnalysis;
  crossRealmRisks: CrossRealmRisk[];
  heroRealm: string;
  heroPoint?: ProgressionPoint;
  spiritualRootLabel?: string;
  cultivationRange?: string;
};

export function CurveInsights({
  progression,
  realmCurve,
  crossRealmRisks,
  heroRealm,
  heroPoint,
  spiritualRootLabel,
  cultivationRange,
}: Props) {
  const crossText =
    crossRealmRisks.length === 0
      ? "相邻跨境界未发现明显崩坏（胜率低于 42% 的配对）。"
      : crossRealmRisks
          .slice(0, 3)
          .map(
            (risk) =>
              `${risk.heroRealm}→${risk.enemyRealm} 胜率 ${formatNumber(risk.winChance * 100, 0)}%（${risk.verdict}）`,
          )
          .join("；");

  const heroGate =
    heroPoint?.heroVsNextWin !== null && heroPoint?.heroVsNextWin !== undefined
      ? `当前 ${heroRealm} 挑战下境界胜率 ${formatNumber(heroPoint.heroVsNextWin * 100, 0)}%。`
      : "";

  const items = [
    {
      title: "进度轴（养成对战）",
      text: `${progression.grade}。${progression.summary} ${heroGate}`,
    },
    {
      title: "境界倍率轴",
      text: `${realmCurve.grade}，跨度 ${formatNumber(realmCurve.span, 0)}x，最大跳变 ${formatNumber(realmCurve.maxJump.jump, 2)}x（${realmCurve.maxJump.from}→${realmCurve.maxJump.to}）。`,
    },
    {
      title: "跨境界风险",
      text: crossText,
    },
    {
      title: "养成轴（灵根）",
      text: spiritualRootLabel
        ? `当前品相 ${spiritualRootLabel}。全轴修炼速度 ${cultivationRange ?? "—"}，单灵根应明显高于四/五伪灵根。`
        : `全轴修炼速度 ${cultivationRange ?? "—"}。`,
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.title}
          className="min-h-[78px] rounded-lg border border-[#d7c7aa]/75 bg-[rgba(255,250,240,0.7)] p-2.5"
        >
          <strong className="block text-sm">{item.title}</strong>
          <span className="text-xs leading-snug text-[#6f6559]">{item.text}</span>
        </div>
      ))}
    </div>
  );
}
