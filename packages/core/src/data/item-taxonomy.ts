export type EquipmentDomain = "wearable" | "artifact" | "bagItem" | "special";

export const equipmentSlotOptions = [
  "武器",
  "防具",
  "饰品",
  "法器",
  "符箓",
  "傀儡",
  "储物袋",
  "特殊物",
  "其他",
] as const;

export type EquipmentSlot = (typeof equipmentSlotOptions)[number];

export const equipmentSlotSchema = equipmentSlotOptions;

export const weaponKindOptions = ["短兵", "长兵", "远程武器"] as const;

export type WeaponKindId = (typeof weaponKindOptions)[number];

export const weaponCategoriesByKind: Record<WeaponKindId, readonly string[]> = {
  短兵: ["剑", "刀", "拳套"],
  长兵: ["枪", "棍", "矛"],
  远程武器: ["暗器", "弓箭"],
};

const allWeaponCategories = weaponKindOptions.flatMap((kind) => [...weaponCategoriesByKind[kind]]);

const legacyWeaponCategoryToId: Record<string, string> = {
  剑: "剑",
  刀: "刀",
  拳套: "拳套",
  枪: "枪",
  棍: "棍",
  矛: "矛",
  暗器: "暗器",
  弓箭: "弓箭",
  弓: "弓箭",
};

export function getWeaponKind(category: string): WeaponKindId | null {
  const trimmed = category.trim();
  for (const kind of weaponKindOptions) {
    if ((weaponCategoriesByKind[kind] as readonly string[]).includes(trimmed)) return kind;
  }
  return null;
}

export function getWeaponCategoryOptions(kind: WeaponKindId): string[] {
  return [...weaponCategoriesByKind[kind]];
}

export function migrateLegacyWeaponCategory(category: string): string {
  const trimmed = category.trim();
  if (!trimmed) return "剑";
  if (allWeaponCategories.includes(trimmed)) return trimmed;
  return legacyWeaponCategoryToId[trimmed] ?? "剑";
}

export const equipmentCategoriesBySlot: Record<EquipmentSlot, readonly string[]> = {
  武器: allWeaponCategories,
  防具: ["衣服", "衣甲", "靴子", "帽子", "头巾"],
  饰品: ["戒指", "玉佩"],
  法器: ["护符", "飞剑法器", "阵盘", "法宝"],
  符箓: ["攻击符", "防御符", "辅助符"],
  傀儡: ["木傀儡", "战斗傀儡", "机关傀儡"],
  储物袋: ["储物袋"],
  特殊物: ["机缘物"],
  其他: ["其他"],
};

const slotToDomain: Record<EquipmentSlot, EquipmentDomain> = {
  武器: "wearable",
  防具: "wearable",
  饰品: "wearable",
  法器: "artifact",
  符箓: "bagItem",
  傀儡: "bagItem",
  储物袋: "wearable",
  特殊物: "special",
  其他: "special",
};

export const equipmentTaxonomyGroups = [
  {
    id: "wearable",
    label: "身上装备栏",
    description:
      "武器栏×1（短兵/长兵/远程武器）、防具栏（衣甲/靴/帽各×1）、佩饰栏×4、储物袋栏×1；穿在身上，各有数量上限。储物袋提供背包容量加成，更换即替换加成。",
    slots: ["武器", "防具", "饰品", "储物袋"] as const,
  },
  {
    id: "artifact",
    label: "法器",
    description: "法器栏（护符、飞剑法器、阵盘、法宝），最多装备 2 个，与佩饰栏独立。",
    slots: ["法器"] as const,
  },
  {
    id: "bagItem",
    label: "背包物品",
    description: "符箓、傀儡；不占身上装备栏，仅占用背包格数。傀儡为战斗单位。",
    slots: ["符箓", "傀儡"] as const,
  },
  {
    id: "special",
    label: "特殊",
    description: "机缘物等剧情/经济向条目，及其他未归类。",
    slots: ["特殊物", "其他"] as const,
  },
] as const;

const domainLabels: Record<EquipmentDomain, string> = {
  wearable: "身上装备栏",
  artifact: "法器",
  bagItem: "背包物品",
  special: "特殊",
};

export function getEquipmentDomainLabel(slot: string): string {
  return domainLabels[getEquipmentDomain(slot)];
}

export function getEquipmentDomain(slot: string): EquipmentDomain {
  if (slot in slotToDomain) return slotToDomain[slot as EquipmentSlot];
  return "special";
}

export function getEquipmentCategoryOptions(slot: string): string[] {
  const categories = equipmentCategoriesBySlot[slot as EquipmentSlot];
  return categories ? [...categories] : [...equipmentCategoriesBySlot["其他"]];
}

export function normalizeEquipmentSlot(slot: string): EquipmentSlot {
  if ((equipmentSlotOptions as readonly string[]).includes(slot)) return slot as EquipmentSlot;
  return "其他";
}

export function normalizeEquipmentCategory(slot: string, category: string): string {
  const normalizedSlot = normalizeEquipmentSlot(slot);
  const trimmed = category.trim();
  if (normalizedSlot === "武器") {
    const migrated = migrateLegacyWeaponCategory(trimmed);
    const options = getEquipmentCategoryOptions("武器");
    if (options.includes(migrated)) return migrated;
    return options[0]!;
  }
  const options = getEquipmentCategoryOptions(normalizedSlot);
  if (trimmed && options.includes(trimmed)) return trimmed;
  return options[0]!;
}

export function isEquipmentSlot(value: string): value is EquipmentSlot {
  return (equipmentSlotOptions as readonly string[]).includes(value);
}

export type EquipmentTypeOption = {
  domain: EquipmentDomain;
  slot: EquipmentSlot;
  category: string;
  detailLabel: string;
  weaponKind?: WeaponKindId;
};

const TYPE_KEY_SEP = "::";

function buildDetailLabel(
  slot: EquipmentSlot,
  category: string,
  domain: EquipmentDomain,
  weaponKind?: WeaponKindId,
) {
  if (slot === "武器" && weaponKind) {
    return `${weaponKind} · ${category}`;
  }
  const group = equipmentTaxonomyGroups.find((g) => g.id === domain);
  const multiSlot = (group?.slots.length ?? 0) > 1;
  const multiCategory = equipmentCategoriesBySlot[slot].length > 1;
  if (multiSlot || multiCategory) return `${slot} · ${category}`;
  return category;
}

function buildEquipmentTypeCatalog(): EquipmentTypeOption[] {
  const out: EquipmentTypeOption[] = [];
  for (const group of equipmentTaxonomyGroups) {
    for (const slot of group.slots) {
      if (slot === "武器") {
        for (const kind of weaponKindOptions) {
          for (const category of weaponCategoriesByKind[kind]) {
            out.push({
              domain: group.id,
              slot,
              category,
              weaponKind: kind,
              detailLabel: buildDetailLabel(slot, category, group.id, kind),
            });
          }
        }
        continue;
      }
      for (const category of equipmentCategoriesBySlot[slot]) {
        out.push({
          domain: group.id,
          slot,
          category,
          detailLabel: buildDetailLabel(slot, category, group.id),
        });
      }
    }
  }
  return out;
}

export const equipmentTypeCatalog = buildEquipmentTypeCatalog();

export function encodeEquipmentTypeKey(slot: string, category: string) {
  return `${normalizeEquipmentSlot(slot)}${TYPE_KEY_SEP}${normalizeEquipmentCategory(slot, category)}`;
}

export function decodeEquipmentTypeKey(key: string): { slot: EquipmentSlot; category: string } | null {
  const idx = key.indexOf(TYPE_KEY_SEP);
  if (idx < 0) return null;
  const slot = normalizeEquipmentSlot(key.slice(0, idx));
  const category = normalizeEquipmentCategory(slot, key.slice(idx + TYPE_KEY_SEP.length));
  return { slot, category };
}

export function getEquipmentTypesForDomain(domain: EquipmentDomain): EquipmentTypeOption[] {
  return equipmentTypeCatalog.filter((t) => t.domain === domain);
}

export function findEquipmentTypeOption(slot: string, category: string): EquipmentTypeOption | undefined {
  const key = encodeEquipmentTypeKey(slot, category);
  return equipmentTypeCatalog.find((t) => encodeEquipmentTypeKey(t.slot, t.category) === key);
}

export function formatEquipmentTypeLabel(slot: string, category: string): string {
  const normalizedSlot = normalizeEquipmentSlot(slot);
  const normalizedCategory = normalizeEquipmentCategory(normalizedSlot, category);
  const found = findEquipmentTypeOption(normalizedSlot, normalizedCategory);
  return found?.detailLabel ?? `${normalizedSlot} · ${normalizedCategory}`;
}

export function getDefaultEquipmentTypeForDomain(domain: EquipmentDomain): EquipmentTypeOption {
  return getEquipmentTypesForDomain(domain)[0]!;
}
