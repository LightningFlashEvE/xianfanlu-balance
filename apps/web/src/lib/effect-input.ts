import type { EffectOption } from "./game-meta";
import { combatEffectOptions, growthEffectOptions } from "./game-meta";

export function getEffectMeta(key: string, group: "combat" | "growth"): EffectOption {
  const list = group === "combat" ? combatEffectOptions : growthEffectOptions;
  return (
    list.find((item) => item.key === key) ?? {
      key,
      label: key,
      unit: "",
      step: 1,
      inputType: "raw",
      defaultValue: 1,
    }
  );
}

export function effectValueToInput(key: string, value: number, group: "combat" | "growth") {
  const meta = getEffectMeta(key, group);
  if (meta.inputType === "decimalPercent" || meta.inputType === "multiplierPercent") {
    return value * 100;
  }
  return value;
}

export function inputValueToEffectValue(key: string, inputValue: number, group: "combat" | "growth") {
  const meta = getEffectMeta(key, group);
  if (meta.inputType === "decimalPercent" || meta.inputType === "multiplierPercent") {
    return inputValue / 100;
  }
  return inputValue;
}

export function defaultEffectValue(key: string, group: "combat" | "growth") {
  const meta = getEffectMeta(key, group);
  return inputValueToEffectValue(key, meta.defaultValue, group);
}
