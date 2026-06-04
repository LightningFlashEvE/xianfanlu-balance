"use client";

import { useMemo } from "react";
import { validateLoadout, type EquipmentInstance } from "@xianfanlu/core";
import {
  buildWearExcludeIds,
  equipmentLabel,
  flattenLoadoutIds,
  optionsForBag,
  optionsForWearKey,
  partitionLoadoutIds,
  setWearSlotId,
  wearSlotSpecs,
} from "@/lib/sandbox-loadout";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  ids: string[];
  equipment: EquipmentInstance[];
  baseBagCapacity: number;
  pending: boolean;
  message: string;
  onChange: (ids: string[]) => void;
};

export function CharacterLoadoutPanel({
  title,
  ids,
  equipment,
  baseBagCapacity,
  pending,
  message,
  onChange,
}: Props) {
  const { wear, bag } = useMemo(() => partitionLoadoutIds(ids, equipment), [ids, equipment]);
  const applyIds = (nextWear: Record<string, string[]>, nextBag: string[]) => {
    onChange(flattenLoadoutIds(nextWear, nextBag));
  };

  const status = validateLoadout(equipment, ids, baseBagCapacity);
  const updateWear = (key: string, index: number, value: string) => {
    const nextWear: Record<string, string[]> = {};
    for (const spec of wearSlotSpecs) {
      nextWear[spec.key] = [...(wear[spec.key] ?? [])];
    }
    setWearSlotId(nextWear, key, index, value);
    applyIds(nextWear, bag);
  };

  const addBagItem = () => {
    const exclude = new Set([...ids]);
    const pick = optionsForBag(equipment, exclude)[0];
    if (!pick) return;
    applyIds(wear, [...bag, pick.instanceId]);
  };

  const updateBag = (index: number, value: string) => {
    const nextBag = [...bag];
    if (!value) nextBag.splice(index, 1);
    else nextBag[index] = value;
    applyIds(wear, nextBag);
  };

  const removeBag = (index: number) => {
    const nextBag = bag.filter((_, i) => i !== index);
    applyIds(wear, nextBag);
  };

  return (
    <div className="rounded-lg border border-[#d7c7aa]/80 bg-[linear-gradient(180deg,rgba(255,252,245,0.95),rgba(255,248,238,0.88))] p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-[#d7c7aa]/50 pb-2">
        <h3 className="text-sm font-extrabold text-[#252019]">{title}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-extrabold text-[#fffaf0] ${status.valid ? "bg-[#1f7a69]" : "bg-[#a94435]"}`}
        >
          携带 {status.used}/{status.capacity}
        </span>
      </div>
      {message ? <p className="mb-2 text-xs text-[#a94435]">{message}</p> : null}

      <section className="mb-4">
        <p className="mb-2 text-xs font-bold text-[#15584c]">身上装备栏</p>
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {wearSlotSpecs.slice(0, 4).map((spec) => (
              <WearSlotGroup
                key={spec.key}
                spec={spec}
                ids={wear[spec.key] ?? []}
                equipment={equipment}
                wear={wear}
                pending={pending}
                onSelect={(index, value) => updateWear(spec.key, index, value)}
              />
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <WearSlotGroup
              spec={wearSlotSpecs.find((s) => s.key === "artifact")!}
              ids={wear.artifact ?? []}
              equipment={equipment}
              wear={wear}
              pending={pending}
              onSelect={(index, value) => updateWear("artifact", index, value)}
            />
            <WearSlotGroup
              spec={wearSlotSpecs.find((s) => s.key === "accessory")!}
              ids={wear.accessory ?? []}
              equipment={equipment}
              wear={wear}
              pending={pending}
              onSelect={(index, value) => updateWear("accessory", index, value)}
            />
          </div>
          <WearSlotGroup
            spec={wearSlotSpecs.find((s) => s.key === "storage-bag")!}
            ids={wear["storage-bag"] ?? []}
            equipment={equipment}
            wear={wear}
            pending={pending}
            compact
            onSelect={(index, value) => updateWear("storage-bag", index, value)}
          />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-[#6f6559]">背包物品（符箓、傀儡、特殊物等）</p>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={addBagItem}>
            放入背包
          </Button>
        </div>
        <p className="mb-2 text-[11px] text-[#6f6559]">
          不占身上栏位，仅消耗背包格数；容量含身上已装备件数与储物袋加成。
        </p>
        <div className="grid gap-1.5">
          {bag.length === 0 ? (
            <p className="rounded-md border border-dashed border-[#d7c7aa]/70 px-2 py-3 text-center text-xs text-[#6f6559]">
              背包为空
            </p>
          ) : (
            bag.map((id, index) => (
              <div key={`${id}-${index}`} className="flex gap-1.5">
                <select
                  className="min-h-8 flex-1 rounded-md border border-[#d7c7aa] bg-[#fffdf7] px-2 text-xs"
                  value={id}
                  disabled={pending}
                  onChange={(e) => updateBag(index, e.target.value)}
                >
                  {optionsForBag(equipment, new Set(ids.filter((x) => x !== id)), id).map((item) => (
                    <option key={item.instanceId} value={item.instanceId}>
                      {equipmentLabel(item)}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => removeBag(index)}
                >
                  取出
                </Button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function WearSlotGroup({
  spec,
  ids,
  equipment,
  wear,
  pending,
  compact,
  onSelect,
}: {
  spec: { key: string; label: string; max: number };
  ids: string[];
  equipment: EquipmentInstance[];
  wear: Record<string, string[]>;
  pending: boolean;
  compact?: boolean;
  onSelect: (index: number, value: string) => void;
}) {
  const slots = Array.from({ length: spec.max }, (_, i) => ids[i] ?? "");

  return (
    <div
      className={`rounded-md border border-[#d7c7aa]/60 bg-[#fffdf7]/90 p-2 ${compact ? "max-w-xs" : ""}`}
    >
      <p className="mb-1.5 text-[11px] font-extrabold text-[#6f6559]">
        {spec.label}
        {spec.max > 1 ? ` ×${spec.max}` : ""}
      </p>
      <div className={`grid gap-1.5 ${spec.max > 2 ? "grid-cols-2" : "grid-cols-1"}`}>
        {slots.map((id, index) => (
          <select
            key={`${spec.key}-${index}`}
            className="min-h-8 w-full rounded border border-[#d7c7aa] bg-white px-1.5 text-xs"
            value={id}
            disabled={pending}
            onChange={(e) => onSelect(index, e.target.value)}
          >
            <option value="">— 空 —</option>
            {optionsForWearKey(
              spec.key,
              equipment,
              buildWearExcludeIds(wear, spec.key, index),
              id || undefined,
            ).map((item) => (
              <option key={item.instanceId} value={item.instanceId}>
                {item.name}
              </option>
            ))}
          </select>
        ))}
      </div>
    </div>
  );
}
