"use server";

import { revalidateBalancePages } from "@/lib/revalidate-paths";
import { computeSandboxCombat } from "@/lib/sandbox-combat";
import {
  filterEnemyEquipmentIdsForRealm,
  resolveAllSandboxEnemyPresets,
} from "@xianfanlu/core";
import { prisma } from "@/lib/db";
import { listManualActivation } from "./evaluator";
import { loadBalanceState } from "./state";

export async function getSandboxData() {
  const [state, manuals] = await Promise.all([loadBalanceState(), listManualActivation()]);
  const combat = computeSandboxCombat(state);
  return {
    realms: state.realms.map((r) => r.name),
    manuals,
    equipment: state.equipment.map((e) => ({
      id: e.instanceId,
      label: `${e.name} / ${e.category} / ${e.quality}`,
    })),
    config: {
      attackerRealm: state.attackerRealm,
      defenderRealm: state.defenderRealm,
      enemyTemplateScale: state.enemyTemplateScale,
      baseBagCapacity: state.baseBagCapacity,
      heroEquipmentIds: state.heroEquipmentIds,
      enemyEquipmentIds: state.enemyEquipmentIds,
    },
    duel: combat.duel,
    heroPower: combat.heroPower,
    enemyPower: combat.enemyPower,
    enemyPresets: resolveAllSandboxEnemyPresets(state.equipment, state.baseBagCapacity),
  };
}

export type SandboxConfigUpdate = {
  attackerRealm?: string;
  defenderRealm?: string;
  enemyTemplateScale?: number;
  baseBagCapacity?: number;
  heroEquipmentIds?: string[];
  enemyEquipmentIds?: string[];
};

export async function updateSandboxConfig(update: SandboxConfigUpdate) {
  const current = await prisma.heroConfig.findUnique({ where: { id: 1 } });
  if (!current) {
    throw new Error("HeroConfig 未初始化，请先执行 pnpm db:seed");
  }

  const currentState = await loadBalanceState();
  const defenderRealm = update.defenderRealm ?? current.defenderRealm;
  const enemyEquipmentIds = filterEnemyEquipmentIdsForRealm(
    currentState.equipment,
    update.enemyEquipmentIds ?? (current.enemyEquipmentIds as string[]),
    defenderRealm,
  );

  await prisma.heroConfig.update({
    where: { id: 1 },
    data: {
      attackerRealm: update.attackerRealm ?? current.attackerRealm,
      defenderRealm,
      enemyTemplateScale: update.enemyTemplateScale ?? current.enemyTemplateScale,
      baseBagCapacity: update.baseBagCapacity ?? current.baseBagCapacity,
      heroEquipmentIds: update.heroEquipmentIds ?? (current.heroEquipmentIds as string[]),
      enemyEquipmentIds,
    },
  });

  revalidateBalancePages();
  const state = await loadBalanceState();
  return computeSandboxCombat(state);
}

/** 功法勾选/熟练度变更后重算对战与战力（不写 HeroConfig） */
export async function recalculateSandboxCombat() {
  const state = await loadBalanceState();
  return computeSandboxCombat(state);
}
