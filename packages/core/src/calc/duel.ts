import { clampNumber } from "../lib/numbers";
import { calculatePower } from "./power";
import type { HeroStats } from "../schemas/hero";

export function makeCombatant(
  stats: HeroStats,
  realmMultiplier: number,
  potentialScale: number,
  templateScale: number,
): HeroStats {
  const scale = Math.sqrt(Math.max(realmMultiplier, 0.01)) * potentialScale * templateScale;
  return {
    ...stats,
    hp: stats.hp * scale,
    stamina: stats.stamina * scale,
    attack: stats.attack * scale,
    defense: stats.defense * Math.pow(scale, 0.88),
    speed: stats.speed * Math.pow(scale, 0.22),
    innerPower: stats.innerPower * scale,
    spiritualPower: stats.spiritualPower * scale,
    spiritShield: stats.spiritShield * scale,
    divineSense: stats.divineSense * Math.pow(scale, 0.75),
    spellPower: stats.spellPower * scale,
  };
}

export function calculateDuelDps(attacker: HeroStats, defender: HeroStats): number {
  const hit = clampNumber((attacker.hitRate - defender.dodgeRate) / 100, 0.08, 0.98);
  const critFactor =
    1 + clampNumber(attacker.critRate / 100, 0, 1) * Math.max(attacker.critDamage / 100 - 1, 0);
  const interval = Math.max(attacker.attackInterval / (1 + attacker.speed / 260), 0.2);
  const rawDamage =
    attacker.attack +
    attacker.spellPower * 0.55 +
    attacker.innerPower * 0.08 +
    attacker.spiritualPower * 0.14 +
    Math.max(attacker.divineSense - defender.divineSense, 0) * 0.05;
  const guard = defender.defense * 0.68 + defender.spiritualPower * 0.05 + defender.divineSense * 0.04;
  const damage = Math.max(rawDamage - guard, rawDamage * 0.16, 1);
  return (damage * hit * critFactor) / interval;
}

export function calculateEffectiveHp(combatant: HeroStats): number {
  return (combatant.hp + combatant.spiritShield) * (1 + combatant.defense / (combatant.defense + 90));
}

export function winChanceFromTtk(heroTtk: number, enemyTtk: number): number {
  const ratio = Math.log(Math.max(enemyTtk, 0.001) / Math.max(heroTtk, 0.001));
  return clampNumber(1 / (1 + Math.exp(-2.2 * ratio)), 0.01, 0.99);
}

export function duelVerdict(chance: number, gap: number): string {
  if (chance >= 0.72) return "优势明显，敌方需要机制或数值补强";
  if (chance >= 0.55) return "小优，适合主线推进";
  if (chance >= 0.45) return "接近五五开，适合关卡守门";
  if (gap < 0.5) return "劣势很大，跨阶挑战需要资源补偿";
  return "偏劣，适合高风险挑战";
}

export function simulateDuel(params: {
  heroStats: HeroStats;
  enemyStats: HeroStats;
  heroRealmMultiplier: number;
  enemyRealmMultiplier: number;
  heroPotentialMultiplier: number;
  enemyTemplateScale: number;
}) {
  const hero = makeCombatant(
    params.heroStats,
    params.heroRealmMultiplier,
    Math.sqrt(params.heroPotentialMultiplier),
    1,
  );
  const enemy = makeCombatant(params.enemyStats, params.enemyRealmMultiplier, 1, params.enemyTemplateScale);
  const heroDps = calculateDuelDps(hero, enemy);
  const enemyDps = calculateDuelDps(enemy, hero);
  const heroTtk = calculateEffectiveHp(enemy) / heroDps;
  const enemyTtk = calculateEffectiveHp(hero) / enemyDps;
  const chance = winChanceFromTtk(heroTtk, enemyTtk);
  const heroPower = calculatePower(hero, 1, 1).total;
  const enemyPower = calculatePower(enemy, 1, 1).total;
  const gap = heroPower / Math.max(enemyPower, 0.0001);
  return {
    heroTtk,
    enemyTtk,
    heroDps,
    enemyDps,
    chance,
    gap,
    verdict: duelVerdict(chance, gap),
  };
}
