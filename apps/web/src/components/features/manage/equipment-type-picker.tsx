"use client";

import {
  encodeEquipmentTypeKey,
  equipmentTaxonomyGroups,
  findEquipmentTypeOption,
  getDefaultEquipmentTypeForDomain,
  getEquipmentDomain,
  getEquipmentTypesForDomain,
  weaponKindOptions,
  type EquipmentDomain,
  type EquipmentSlot,
  type EquipmentTypeOption,
} from "@xianfanlu/core";

type Props = {
  slot: EquipmentSlot;
  category: string;
  disabled?: boolean;
  onChange: (slot: EquipmentSlot, category: string) => void;
};

function groupWearableTypes(types: EquipmentTypeOption[]) {
  const weapons = types.filter((t) => t.slot === "武器");
  const other = types.filter((t) => t.slot !== "武器");
  const weaponsByKind = weaponKindOptions.map((kind) => ({
    kind,
    types: weapons.filter((t) => t.weaponKind === kind),
  }));
  return { other, weaponsByKind };
}

export function EquipmentTypePicker({ slot, category, disabled, onChange }: Props) {
  const domain = getEquipmentDomain(slot);
  const typeKey = encodeEquipmentTypeKey(slot, category);
  const typesInDomain = getEquipmentTypesForDomain(domain);
  const resolvedTypeKey = typesInDomain.some(
    (t) => encodeEquipmentTypeKey(t.slot, t.category) === typeKey,
  )
    ? typeKey
    : typesInDomain[0]
      ? encodeEquipmentTypeKey(typesInDomain[0].slot, typesInDomain[0].category)
      : typeKey;

  const handleDomainChange = (nextDomain: EquipmentDomain) => {
    const current = findEquipmentTypeOption(slot, category);
    if (current?.domain === nextDomain) return;
    const fallback = getDefaultEquipmentTypeForDomain(nextDomain);
    onChange(fallback.slot, fallback.category);
  };

  const handleTypeChange = (nextKey: string) => {
    const types = getEquipmentTypesForDomain(domain);
    const picked = types.find((t) => encodeEquipmentTypeKey(t.slot, t.category) === nextKey);
    if (picked) onChange(picked.slot, picked.category);
  };

  const renderTypeOptions = () => {
    if (domain !== "wearable") {
      return typesInDomain.map((t) => {
        const key = encodeEquipmentTypeKey(t.slot, t.category);
        return (
          <option key={key} value={key}>
            {t.detailLabel}
          </option>
        );
      });
    }

    const { other, weaponsByKind } = groupWearableTypes(typesInDomain);
    return (
      <>
        {other.map((t) => {
          const key = encodeEquipmentTypeKey(t.slot, t.category);
          return (
            <option key={key} value={key}>
              {t.detailLabel}
            </option>
          );
        })}
        {weaponsByKind.map(({ kind, types }) =>
          types.length > 0 ? (
            <optgroup key={kind} label={kind}>
              {types.map((t) => {
                const key = encodeEquipmentTypeKey(t.slot, t.category);
                return (
                  <option key={key} value={key}>
                    {t.detailLabel}
                  </option>
                );
              })}
            </optgroup>
          ) : null,
        )}
      </>
    );
  };

  return (
    <div className="grid min-w-[160px] gap-1">
      <select
        className="w-full min-h-8 rounded-md border border-[#d7c7aa] px-1 text-sm"
        value={domain}
        disabled={disabled}
        aria-label="装备范围"
        onChange={(e) => handleDomainChange(e.target.value as EquipmentDomain)}
      >
        {equipmentTaxonomyGroups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.label}
          </option>
        ))}
      </select>
      <select
        className="w-full min-h-8 rounded-md border border-[#d7c7aa] px-1 text-sm"
        value={resolvedTypeKey}
        disabled={disabled || typesInDomain.length === 0}
        aria-label="详细类型"
        onChange={(e) => handleTypeChange(e.target.value)}
      >
        {renderTypeOptions()}
      </select>
    </div>
  );
}
