import {
  buildRealmOrderMap,
  getEvaluationContext,
  resolveMilestoneEquipmentIds,
  resolveMilestoneManuals,
  type EvaluationInput,
} from "@xianfanlu/core";
import type { loadBalanceState } from "@/actions/state";

export type BalanceState = Awaited<ReturnType<typeof loadBalanceState>>;

export function getMilestoneEvaluation(state: BalanceState, targetRealm = state.heroRealm) {
  const realmOrder = buildRealmOrderMap(
    state.realms.map((r) => ({ name: r.name, sortOrder: r.sortOrder ?? 0 })),
  );
  const equipmentIds = resolveMilestoneEquipmentIds(state.equipment, targetRealm, realmOrder);
  const milestoneManuals = resolveMilestoneManuals(state.manuals, targetRealm, realmOrder);

  const evaluationBase: Omit<EvaluationInput, "includeManuals"> = {
    baseStats: state.stats,
    aptitude: state.aptitude,
    equipment: state.equipment,
    manuals: milestoneManuals,
    equipmentIds,
    manualFilter: "milestone",
  };

  const context = getEvaluationContext({
    ...evaluationBase,
    includeManuals: true,
  });

  const contextWithoutManuals = getEvaluationContext({
    ...evaluationBase,
    includeManuals: false,
  });

  return { context, contextWithoutManuals, equipmentIds, milestoneManuals, targetRealm };
}
