import { toNumber } from "../lib/numbers";
import type { EquipmentInstance } from "../schemas/equipment";

export function getLoadoutLimit(item: Pick<EquipmentInstance, "slot" | "category">) {
  if (item.slot === "武器") return { key: "weapon", label: "武器", max: 1 };
  if (item.slot === "防具") {
    if (item.category === "衣服" || item.category === "衣甲") {
      return { key: "armor-body", label: "衣服/衣甲", max: 1 };
    }
    if (item.category === "靴子") return { key: "armor-boots", label: "靴子", max: 1 };
    if (item.category === "帽子" || item.category === "头巾") {
      return { key: "armor-head", label: "帽子/头巾", max: 1 };
    }
    return { key: `armor-${item.category}`, label: item.category || "防具", max: 1 };
  }
  if (item.slot === "饰品") return { key: "accessory", label: "佩饰", max: 4 };
  if (item.slot === "法器") return { key: "artifact", label: "法器", max: 2 };
  if (item.slot === "储物袋") return { key: "storage-bag", label: "储物袋", max: 1 };
  return null;
}

export function calculateBagCapacity(items: EquipmentInstance[], baseBagCapacity: number) {
  const bonus = items.reduce((sum, item) => sum + toNumber(item.growth?.bagCapacityFlat, 0), 0);
  return Math.max(1, Math.round(toNumber(baseBagCapacity, 12) + bonus));
}

export function validateLoadout(
  equipment: EquipmentInstance[],
  ids: string[],
  baseBagCapacity: number,
) {
  const items = ids
    .map((id) => equipment.find((item) => item.instanceId === id))
    .filter((item): item is EquipmentInstance => Boolean(item));
  const capacity = calculateBagCapacity(items, baseBagCapacity);
  const used = items.length;
  if (used > capacity) {
    return { valid: false as const, used, capacity, message: `背包容量不足：已携带 ${used}，容量 ${capacity}。` };
  }

  const counts: Record<string, number> = {};
  for (const item of items) {
    const limit = getLoadoutLimit(item);
    if (!limit) continue;
    counts[limit.key] = (counts[limit.key] ?? 0) + 1;
    if (counts[limit.key]! > limit.max) {
      return { valid: false as const, used, capacity, message: `${limit.label}最多只能装配 ${limit.max} 个。` };
    }
  }

  return { valid: true as const, used, capacity, message: "装配规则正常。" };
}
