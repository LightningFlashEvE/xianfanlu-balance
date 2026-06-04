import {
  formatEquipmentTypeLabel,
  getLoadoutLimit,
  type EquipmentInstance,
} from "@xianfanlu/core";

export type WearSlotSpec = {
  key: string;
  label: string;
  max: number;
};

/** 身上装备栏 UI 顺序（与策划栏位一致） */
export const wearSlotSpecs: WearSlotSpec[] = [
  { key: "weapon", label: "武器", max: 1 },
  { key: "armor-body", label: "衣甲", max: 1 },
  { key: "armor-boots", label: "靴子", max: 1 },
  { key: "armor-head", label: "头饰", max: 1 },
  { key: "artifact", label: "法器", max: 2 },
  { key: "accessory", label: "佩饰", max: 4 },
  { key: "storage-bag", label: "储物袋", max: 1 },
];

export function isWearSlotItem(item: Pick<EquipmentInstance, "slot" | "category">) {
  return getLoadoutLimit(item) !== null;
}

export function getWearSlotKey(item: Pick<EquipmentInstance, "slot" | "category">) {
  return getLoadoutLimit(item)?.key ?? null;
}

export function partitionLoadoutIds(ids: string[], equipment: EquipmentInstance[]) {
  const wear: Record<string, string[]> = {};
  for (const spec of wearSlotSpecs) {
    wear[spec.key] = [];
  }
  const bag: string[] = [];

  for (const id of ids) {
    const item = equipment.find((e) => e.instanceId === id);
    if (!item) continue;
    const key = getWearSlotKey(item);
    if (key && wear[key]) {
      wear[key].push(id);
    } else {
      bag.push(id);
    }
  }

  return { wear, bag };
}

export function flattenLoadoutIds(wear: Record<string, string[]>, bag: string[]) {
  const ids: string[] = [];
  for (const spec of wearSlotSpecs) {
    for (const id of wear[spec.key] ?? []) {
      if (id) ids.push(id);
    }
  }
  for (const id of bag) {
    if (id) ids.push(id);
  }
  return ids;
}

export function equipmentLabel(item: EquipmentInstance) {
  return `${item.name} · ${formatEquipmentTypeLabel(item.slot, item.category)} · ${item.quality}`;
}

export function buildWearExcludeIds(
  wear: Record<string, string[]>,
  exceptKey?: string,
  exceptIndex?: number,
) {
  const set = new Set<string>();
  for (const spec of wearSlotSpecs) {
    (wear[spec.key] ?? []).forEach((id, i) => {
      if (!id) return;
      if (spec.key === exceptKey && i === exceptIndex) return;
      set.add(id);
    });
  }
  return set;
}

export function optionsForWearKey(
  key: string,
  equipment: EquipmentInstance[],
  excludeIds: Set<string>,
  allowId?: string,
) {
  return equipment.filter((item) => {
    if (getWearSlotKey(item) !== key) return false;
    if (item.instanceId === allowId) return true;
    return !excludeIds.has(item.instanceId);
  });
}

export function optionsForBag(
  equipment: EquipmentInstance[],
  excludeIds: Set<string>,
  allowId?: string,
) {
  return equipment.filter((item) => {
    if (isWearSlotItem(item)) return false;
    if (item.instanceId === allowId) return true;
    return !excludeIds.has(item.instanceId);
  });
}

export function setWearSlotId(
  wear: Record<string, string[]>,
  key: string,
  index: number,
  id: string,
) {
  const spec = wearSlotSpecs.find((s) => s.key === key);
  const max = spec?.max ?? 1;
  const arr = Array.from({ length: max }, (_, i) => (wear[key] ?? [])[i] ?? "");
  if (index >= 0 && index < max) {
    arr[index] = id;
  }
  wear[key] = arr.filter(Boolean);
  return wear;
}
