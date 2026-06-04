import { clampNumber, formatCompact, formatNumber } from "@xianfanlu/core";
import type { HeroStats } from "@xianfanlu/core";

export type RealmPoint = { name: string; multiplier: number };

export function buildRadarAxes(stats: HeroStats) {
  return [
    {
      label: "生存",
      value: clampNumber(stats.hp / 2.6 + stats.defense * 3 + stats.dodgeRate * 1.4 + stats.spiritShield / 3, 0, 100),
    },
    {
      label: "武攻",
      value: clampNumber(stats.attack * 4 + stats.critRate * 1.1 + (stats.critDamage - 100) * 0.24, 0, 100),
    },
    {
      label: "身法",
      value: clampNumber(stats.speed * 5 + stats.hitRate * 0.28 + stats.dodgeRate * 1.6, 0, 100),
    },
    {
      label: "资源",
      value: clampNumber(stats.stamina * 0.45 + stats.innerPower * 0.5 + stats.spiritualPower * 0.65, 0, 100),
    },
    {
      label: "术法",
      value: clampNumber(stats.spellPower * 3.4 + stats.spiritualPower * 0.9 + stats.divineSense * 1.4, 0, 100),
    },
  ];
}

function prepareCanvas(canvas: HTMLCanvasElement, fallbackWidth: number, fallbackHeight: number) {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(rect.width || fallbackWidth, 280);
  const cssHeight = Math.max(rect.height || fallbackHeight, 220);
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssWidth * ratio);
  canvas.height = Math.round(cssHeight * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D 不可用");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width: cssWidth, height: cssHeight };
}

function axisAngle(index: number, total: number) {
  return -Math.PI / 2 + (Math.PI * 2 * index) / total;
}

function polar(center: { x: number; y: number }, radius: number, angle: number) {
  return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  center: { x: number; y: number },
  radius: number,
  sides: number,
  strokeOnly: boolean,
) {
  ctx.beginPath();
  for (let index = 0; index < sides; index += 1) {
    const point = polar(center, radius, axisAngle(index, sides));
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
  if (strokeOnly) ctx.stroke();
  else {
    ctx.fill();
    ctx.stroke();
  }
}

export type ProgressionChartPoint = {
  realm: string;
  heroPower: number;
  mirrorEnemyPower: number;
  nextGatePower: number | null;
};

function drawSeries(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  color: string,
  width: number,
  dashed = false,
) {
  if (points.length === 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dashed) ctx.setLineDash([6, 5]);
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.restore();
}

export function drawProgressionBenchmark(
  canvas: HTMLCanvasElement,
  params: { points: ProgressionChartPoint[]; heroRealm: string; logScale: boolean },
) {
  const { ctx, width, height } = prepareCanvas(canvas, 900, 460);
  const pad = { left: 58, right: 24, top: 36, bottom: 76 };
  const allValues = params.points.flatMap((point) => [
    point.heroPower,
    point.mirrorEnemyPower,
    point.nextGatePower ?? 0,
  ]);
  const positive = allValues.map((value) => Math.max(value, 0.0001));
  const rawMin = Math.min(...positive);
  const rawMax = Math.max(...positive);
  const drawValues = params.logScale ? positive.map((value) => Math.log10(value)) : positive;
  const min = Math.min(...drawValues);
  const max = Math.max(...drawValues);
  const range = Math.max(max - min, 0.0001);
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const count = Math.max(params.points.length - 1, 1);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(37, 32, 25, 0.10)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (chartHeight * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }

  const toY = (value: number) => {
    const scaled = params.logScale ? Math.log10(Math.max(value, 0.0001)) : value;
    return pad.top + chartHeight - ((scaled - min) / range) * chartHeight;
  };
  const toX = (index: number) => pad.left + (chartWidth * index) / count;

  const heroPts = params.points.map((point, index) => ({ x: toX(index), y: toY(point.heroPower) }));
  const mirrorPts = params.points.map((point, index) => ({
    x: toX(index),
    y: toY(point.mirrorEnemyPower),
  }));
  const gatePts = params.points
    .map((point, index) => (point.nextGatePower ? { x: toX(index), y: toY(point.nextGatePower) } : null))
    .filter((point): point is { x: number; y: number } => Boolean(point));

  drawSeries(ctx, mirrorPts, "rgba(111, 101, 89, 0.85)", 2.5, true);
  drawSeries(ctx, gatePts, "#a94435", 3, true);
  drawSeries(ctx, heroPts, "#1f7a69", 4);

  heroPts.forEach((point, index) => {
    const isHero = params.points[index]?.realm === params.heroRealm;
    ctx.beginPath();
    ctx.fillStyle = isHero ? "#a94435" : "#fffdf7";
    ctx.strokeStyle = isHero ? "#a94435" : "#1f7a69";
    ctx.lineWidth = isHero ? 4 : 2;
    ctx.arc(point.x, point.y, isHero ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.fillStyle = "#6f6559";
  ctx.font = "12px Microsoft YaHei, Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (chartHeight * i) / 4;
    const rawValue = rawMax - ((rawMax - rawMin) * i) / 4;
    const label = params.logScale ? formatCompact(rawValue) : formatCompact(rawValue);
    ctx.fillText(label, pad.left - 10, y);
  }

  ctx.fillStyle = "#252019";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "700 13px Microsoft YaHei, Arial";
  ctx.fillText(params.logScale ? "标准养成战力（对数）" : "标准养成战力（线性）", pad.left, 10);

  const legend = [
    { color: "#1f7a69", label: "主角标准" },
    { color: "rgba(111, 101, 89, 0.85)", label: "同阶镜像", dashed: true },
    { color: "#a94435", label: "下境界守门", dashed: true },
  ];
  let lx = pad.left;
  legend.forEach((item) => {
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 3;
    if (item.dashed) ctx.setLineDash([5, 4]);
    else ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(lx, 22);
    ctx.lineTo(lx + 18, 22);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#6f6559";
    ctx.font = "11px Microsoft YaHei, Arial";
    ctx.fillText(item.label, lx + 22, 16);
    lx += 108;
  });

  ctx.save();
  ctx.fillStyle = "#6f6559";
  ctx.font = "11px Microsoft YaHei, Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  heroPts.forEach((point, index) => {
    const realm = params.points[index]?.realm;
    if (!realm) return;
    ctx.save();
    ctx.translate(point.x - 2, height - pad.bottom + 20);
    ctx.rotate(-Math.PI / 5.2);
    ctx.fillText(realm, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

export type CultivationChartPoint = {
  realm: string;
  cultivationSpeed: number;
  breakthroughBonus: number;
};

export function drawCultivationCurve(
  canvas: HTMLCanvasElement,
  params: { points: CultivationChartPoint[]; heroRealm: string; logScale: boolean },
) {
  const { ctx, width, height } = prepareCanvas(canvas, 900, 460);
  const pad = { left: 58, right: 24, top: 36, bottom: 76 };
  const speedValues = params.points.map((p) => Math.max(p.cultivationSpeed, 0.0001));
  const rawMin = Math.min(...speedValues);
  const rawMax = Math.max(...speedValues);
  const flat = rawMax - rawMin < 0.5;
  const axisMin = flat ? Math.max(0, rawMin * 0.92) : rawMin;
  const axisMax = flat ? rawMax * 1.08 : rawMax;
  const drawValues = params.logScale
    ? speedValues.map((v) => Math.log10(v))
    : speedValues.map((v) => v);
  const scaleMin = params.logScale ? Math.log10(Math.max(axisMin, 0.0001)) : axisMin;
  const scaleMax = params.logScale ? Math.log10(Math.max(axisMax, 0.0001)) : axisMax;
  const min = Math.min(scaleMin, scaleMax);
  const max = Math.max(scaleMin, scaleMax);
  const range = Math.max(max - min, 0.0001);
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const count = Math.max(params.points.length - 1, 1);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(37, 32, 25, 0.10)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (chartHeight * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }

  const toY = (value: number) => {
    const scaled = params.logScale ? Math.log10(Math.max(value, 0.0001)) : value;
    return pad.top + chartHeight - ((scaled - min) / range) * chartHeight;
  };
  const toAxisY = (axisValue: number) => {
    const scaled = params.logScale ? Math.log10(Math.max(axisValue, 0.0001)) : axisValue;
    return pad.top + chartHeight - ((scaled - min) / range) * chartHeight;
  };
  const toX = (index: number) => pad.left + (chartWidth * index) / count;

  const speedPts = params.points.map((point, index) => ({
    x: toX(index),
    y: toY(point.cultivationSpeed),
  }));

  drawSeries(ctx, speedPts, "#b7832d", 4);

  speedPts.forEach((point, index) => {
    const isHero = params.points[index]?.realm === params.heroRealm;
    ctx.beginPath();
    ctx.fillStyle = isHero ? "#a94435" : "#fffdf7";
    ctx.strokeStyle = isHero ? "#a94435" : "#b7832d";
    ctx.lineWidth = isHero ? 4 : 2;
    ctx.arc(point.x, point.y, isHero ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.fillStyle = "#6f6559";
  ctx.font = "12px Microsoft YaHei, Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i += 1) {
    const axisValue = axisMax - ((axisMax - axisMin) * i) / 4;
    const y = toAxisY(axisValue);
    ctx.fillText(formatNumber(axisValue, 0), pad.left - 10, y);
  }

  ctx.fillStyle = "#252019";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "700 13px Microsoft YaHei, Arial";
  ctx.fillText(
    params.logScale ? "综合修炼速度 %（对数）" : "综合修炼速度 %（线性）",
    pad.left,
    10,
  );
  ctx.fillStyle = "#6f6559";
  ctx.font = "11px Microsoft YaHei, Arial";
  ctx.fillText(
    flat
      ? "金线：各境界修炼速度相同（见左侧数值）；随境界解锁功法后会拉开差距"
      : "金线：标准养成下各境界修炼速度",
    pad.left,
    28,
  );

  ctx.save();
  ctx.fillStyle = "#6f6559";
  ctx.font = "11px Microsoft YaHei, Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  speedPts.forEach((point, index) => {
    const realm = params.points[index]?.realm;
    if (!realm) return;
    ctx.save();
    ctx.translate(point.x - 2, height - pad.bottom + 20);
    ctx.rotate(-Math.PI / 5.2);
    ctx.fillText(realm, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

export function drawRealmCurve(
  canvas: HTMLCanvasElement,
  params: { realms: RealmPoint[]; heroRealm: string; logScale: boolean },
) {
  const { ctx, width, height } = prepareCanvas(canvas, 900, 460);
  const pad = { left: 58, right: 24, top: 28, bottom: 76 };
  const values = params.realms.map((realm) => Math.max(realm.multiplier, 0.0001));
  const drawValues = params.logScale ? values.map((value) => Math.log10(value)) : values;
  const min = Math.min(...drawValues);
  const max = Math.max(...drawValues);
  const range = Math.max(max - min, 0.0001);
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(37, 32, 25, 0.10)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (chartHeight * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }
  for (let i = 0; i <= 6; i += 1) {
    const x = pad.left + (chartWidth * i) / 6;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, height - pad.bottom);
    ctx.stroke();
  }

  const points = drawValues.map((value, index) => ({
    x: pad.left + (chartWidth * index) / Math.max(drawValues.length - 1, 1),
    y: pad.top + chartHeight - ((value - min) / range) * chartHeight,
  }));

  const gradient = ctx.createLinearGradient(pad.left, 0, width - pad.right, 0);
  gradient.addColorStop(0, "#1f7a69");
  gradient.addColorStop(0.55, "#b7832d");
  gradient.addColorStop(1, "#a94435");

  ctx.lineWidth = 4;
  ctx.strokeStyle = gradient;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  points.forEach((point, index) => {
    const isHero = params.realms[index]?.name === params.heroRealm;
    ctx.beginPath();
    ctx.fillStyle = isHero ? "#a94435" : "#fffdf7";
    ctx.strokeStyle = isHero ? "#a94435" : "#1f7a69";
    ctx.lineWidth = isHero ? 4 : 2;
    ctx.arc(point.x, point.y, isHero ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.fillStyle = "#6f6559";
  ctx.font = "12px Microsoft YaHei, Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i += 1) {
    const value = max - ((max - min) * i) / 4;
    const y = pad.top + (chartHeight * i) / 4;
    const label = params.logScale ? `10^${formatNumber(value, 1)}` : formatCompact(value);
    ctx.fillText(label, pad.left - 10, y);
  }
  ctx.fillStyle = "#252019";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "700 13px Microsoft YaHei, Arial";
  ctx.fillText(params.logScale ? "对数倍率曲线" : "线性倍率曲线", pad.left, 10);
  ctx.textAlign = "right";
  ctx.fillText("层级", width - pad.right, height - 24);

  ctx.save();
  ctx.fillStyle = "#6f6559";
  ctx.font = "11px Microsoft YaHei, Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  points.forEach((point, index) => {
    const realm = params.realms[index];
    if (!realm) return;
    ctx.save();
    ctx.translate(point.x - 2, height - pad.bottom + 20);
    ctx.rotate(-Math.PI / 5.2);
    ctx.fillText(realm.name, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

export function drawRadarChart(
  canvas: HTMLCanvasElement,
  axes: { label: string; value: number }[],
) {
  const { ctx, width, height } = prepareCanvas(canvas, 440, 320);
  const center = { x: width / 2, y: height / 2 + 8 };
  const radius = Math.min(width, height) * 0.34;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(37, 32, 25, 0.12)";
  ctx.lineWidth = 1;
  for (let ring = 1; ring <= 4; ring += 1) {
    drawPolygon(ctx, center, radius * (ring / 4), axes.length, true);
  }

  axes.forEach((axis, index) => {
    const angle = axisAngle(index, axes.length);
    const end = polar(center, radius, angle);
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    const label = polar(center, radius + 22, angle);
    ctx.fillStyle = "#6f6559";
    ctx.font = "12px Microsoft YaHei, Arial";
    ctx.textAlign = label.x < center.x - 8 ? "right" : label.x > center.x + 8 ? "left" : "center";
    ctx.textBaseline = "middle";
    ctx.fillText(axis.label, label.x, label.y);
  });

  const points = axes.map((axis, index) =>
    polar(center, radius * (axis.value / 100), axisAngle(index, axes.length)),
  );
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(31, 122, 105, 0.22)";
  ctx.strokeStyle = "#1f7a69";
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();

  points.forEach((point) => {
    ctx.beginPath();
    ctx.fillStyle = "#b7832d";
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}
