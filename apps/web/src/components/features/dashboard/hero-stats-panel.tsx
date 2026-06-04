"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { HeroStats } from "@xianfanlu/core";
import { getHeroEditorData, updateCombatMultiplier, updateHeroStats } from "@/actions/hero";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type EditorData = Awaited<ReturnType<typeof getHeroEditorData>>;

export function HeroStatsPanel({ initial }: { initial: EditorData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [stats, setStats] = useState(initial.stats);
  const [combatMultiplier, setCombatMultiplier] = useState(initial.combatMultiplier);

  const saveStats = (next: HeroStats) => {
    setStats(next);
    startTransition(async () => {
      await updateHeroStats(next);
      router.refresh();
    });
  };

  const saveMultiplier = (value: number) => {
    setCombatMultiplier(value);
    startTransition(async () => {
      await updateCombatMultiplier(value);
      router.refresh();
    });
  };

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardDescription>Hero Base</CardDescription>
          <CardTitle>主角初始数值</CardTitle>
        </div>
        <label className="grid gap-1 text-xs font-bold text-[#6f6559]">
          潜力倍率
          <input
            type="number"
            min={0.1}
            step={0.1}
            className="w-24 min-h-9 rounded-md border border-[#d7c7aa] bg-[#fffdf7] px-2 text-sm"
            value={combatMultiplier}
            disabled={pending}
            onChange={(e) => saveMultiplier(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {initial.statFields.map((field) => (
          <label key={field.key} className="grid gap-1 text-xs font-bold text-[#6f6559]">
            {field.label}
            <input
              type="number"
              min={field.min}
              max={"max" in field ? field.max : undefined}
              step={field.step}
              className="min-h-8 rounded-md border border-[#d7c7aa] bg-[#fffdf7] px-2 text-sm"
              value={stats[field.key as keyof HeroStats]}
              disabled={pending}
              onChange={(e) => {
                const value = Number(e.target.value);
                saveStats({ ...stats, [field.key]: value } as HeroStats);
              }}
            />
          </label>
        ))}
      </div>
    </Card>
  );
}
