"use client";

import type { ResolvedSandboxEnemyPreset } from "@xianfanlu/core";

type Props = {
  presets: ResolvedSandboxEnemyPreset[];
  activeBandId?: string;
  pending?: boolean;
  onApply: (preset: ResolvedSandboxEnemyPreset) => void;
};

export function SandboxEnemyPresets({ presets, activeBandId, pending, onApply }: Props) {
  return (
    <div className="rounded-lg border border-[#d7c7aa]/80 bg-[rgba(255,250,240,0.55)] p-3">
      <h4 className="mb-1 text-sm font-extrabold text-[#252019]">敌方大期模板</h4>
      <p className="mb-2 text-xs text-[#6f6559]">
        一键套用该大期守门境界与标准养成装备（与评估曲线逻辑一致，不含功法）。
      </p>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const active = preset.bandId === activeBandId;
          return (
            <button
              key={preset.bandId}
              type="button"
              disabled={pending}
              title={preset.summary}
              onClick={() => onApply(preset)}
              className={`rounded-md border px-2.5 py-1.5 text-left text-xs transition disabled:opacity-50 ${
                active
                  ? "border-[#1f7a69] bg-[rgba(31,122,105,0.14)] font-extrabold text-[#1a4f45]"
                  : "border-[#d7c7aa] bg-[#fffdf7] font-bold text-[#252019] hover:border-[#1f7a69]/50"
              }`}
            >
              <span className="block">{preset.label}</span>
              <span className="mt-0.5 block font-normal text-[#6f6559]">
                {preset.defenderRealm} · {preset.equipmentCount} 装
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
