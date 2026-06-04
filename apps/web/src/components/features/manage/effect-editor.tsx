"use client";

import { combatEffectOptions, growthEffectOptions, type EffectOption } from "@/lib/game-meta";
import {
  defaultEffectValue,
  effectValueToInput,
  inputValueToEffectValue,
} from "@/lib/effect-input";
import { Button } from "@/components/ui/button";

type Props = {
  group: "combat" | "growth";
  effects: Record<string, number>;
  onChange: (effects: Record<string, number>) => void;
};

export function EffectEditor({ group, effects, onChange }: Props) {
  const options = group === "combat" ? combatEffectOptions : growthEffectOptions;
  const entries = Object.entries(effects);

  const updateKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    const next = { ...effects };
    const value = next[oldKey] ?? defaultEffectValue(newKey, group);
    delete next[oldKey];
    next[newKey] = next[newKey] ?? value;
    onChange(next);
  };

  const updateValue = (key: string, raw: string) => {
    const next = { ...effects };
    next[key] = inputValueToEffectValue(key, Number(raw), group);
    onChange(next);
  };

  const addKey = (key: string) => {
    const next = { ...effects };
    if (next[key] === undefined) {
      next[key] = defaultEffectValue(key, group);
    }
    onChange(next);
  };

  const removeKey = (key: string) => {
    const next = { ...effects };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="grid gap-2">
      {entries.length === 0 ? (
        <p className="rounded-md border border-dashed border-[#d7c7aa] px-2 py-1 text-xs text-[#6f6559]">无直接影响</p>
      ) : (
        entries.map(([key, value]) => (
          <EffectRow
            key={key}
            effectKey={key}
            value={value}
            options={options}
            group={group}
            onKeyChange={(newKey) => updateKey(key, newKey)}
            onValueChange={(raw) => updateValue(key, raw)}
            onRemove={() => removeKey(key)}
          />
        ))
      )}
      <div className="flex flex-wrap gap-2">
        <select
          className="min-h-8 flex-1 rounded-md border border-[#d7c7aa] bg-[#fffdf7] px-2 text-xs"
          defaultValue={options[0]?.key}
          id={`add-${group}`}
        >
          {options.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const select = document.getElementById(`add-${group}`) as HTMLSelectElement | null;
            if (select) addKey(select.value);
          }}
        >
          添加
        </Button>
      </div>
    </div>
  );
}

function EffectRow({
  effectKey,
  value,
  options,
  group,
  onKeyChange,
  onValueChange,
  onRemove,
}: {
  effectKey: string;
  value: number;
  options: EffectOption[];
  group: "combat" | "growth";
  onKeyChange: (key: string) => void;
  onValueChange: (raw: string) => void;
  onRemove: () => void;
}) {
  const meta = options.find((o) => o.key === effectKey) ?? options[0]!;
  return (
    <div className="grid grid-cols-[1fr_72px_auto_auto] items-center gap-1">
      <select
        className="min-h-8 rounded-md border border-[#d7c7aa] bg-[#fffdf7] px-1 text-xs"
        value={effectKey}
        onChange={(e) => onKeyChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
      <input
        type="number"
        step={meta.step}
        className="min-h-8 rounded-md border border-[#d7c7aa] bg-[#fffdf7] px-1 text-xs"
        value={effectValueToInput(effectKey, value, group)}
        onChange={(e) => onValueChange(e.target.value)}
      />
      <span className="text-center text-xs text-[#6f6559]">{meta.unit}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRemove}>
        移除
      </Button>
    </div>
  );
}
