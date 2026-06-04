import type { Realm } from "../schemas/realm";

export function diagnoseJump(jump: number) {
  if (jump >= 2.8) return { label: "断层过大", level: "danger" as const };
  if (jump >= 2.35) return { label: "压制明显", level: "warn" as const };
  if (jump >= 1.55) return { label: "清晰", level: "good" as const };
  if (jump >= 1.25) return { label: "平滑", level: "soft" as const };
  return { label: "偏平", level: "warn" as const };
}

export function analyzeCurve(realms: Realm[]) {
  const jumps = [];
  for (let index = 1; index < realms.length; index += 1) {
    const prev = realms[index - 1]!;
    const next = realms[index]!;
    jumps.push({
      from: prev.name,
      to: next.name,
      jump: next.multiplier / Math.max(prev.multiplier, 0.0001),
    });
  }

  const maxJump = jumps.reduce((best, item) => (item.jump > best.jump ? item : best), jumps[0]!);
  const hardJumps = jumps.filter((item) => item.jump >= 2.8);
  const steepJumps = jumps.filter((item) => item.jump >= 2.35 && item.jump < 2.8);
  const flatJumps = jumps.filter((item) => item.jump < 1.35);
  const span = realms[realms.length - 1]!.multiplier / Math.max(realms[0]!.multiplier, 0.0001);

  if (hardJumps.length >= 2) {
    return {
      jumps,
      maxJump,
      hardJumps,
      steepJumps,
      flatJumps,
      span,
      grade: "偏硬断层",
      summary: "大境界碾压强，装备和操作空间会被压缩",
    };
  }
  if (hardJumps.length === 1 || steepJumps.length > 0) {
    return {
      jumps,
      maxJump,
      hardJumps,
      steepJumps,
      flatJumps,
      span,
      grade: "可用偏陡",
      summary: "适合突出境界，但跨阶挑战需要额外补偿",
    };
  }
  if (flatJumps.length > 0) {
    return {
      jumps,
      maxJump,
      hardJumps,
      steepJumps,
      flatJumps,
      span,
      grade: "局部偏平",
      summary: "部分升级体感可能不够明显",
    };
  }
  return {
    jumps,
    maxJump,
    hardJumps,
    steepJumps,
    flatJumps,
    span,
    grade: "平稳",
    summary: "层级差清晰，成长曲线相对顺滑",
  };
}
