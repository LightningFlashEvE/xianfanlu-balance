import { balanceExportSchema, type BalanceExportV2 } from "../schemas/balance-export";
import { data } from "../data";
import type { EquipmentDef } from "../schemas/equipment";
import type { ManualDef } from "../schemas/manual";
import type { Realm } from "../schemas/realm";

export function buildBalanceExport(params: {
  realms: Realm[];
  equipment: EquipmentDef[];
  manuals: ManualDef[];
}): BalanceExportV2 {
  const payload = {
    game: "仙凡录" as const,
    balanceVersion: 2 as const,
    exportedAt: new Date().toISOString(),
    realms: params.realms,
    equipment: params.equipment,
    manuals: params.manuals,
    heroDefaults: data.heroDefaults,
  };
  return balanceExportSchema.parse(payload);
}
