"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Aptitude } from "@xianfanlu/core";
import { getHeroEditorData, updateAptitude } from "@/actions/hero";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { SpiritualRootPicker } from "./spiritual-root-picker";

type EditorData = Awaited<ReturnType<typeof getHeroEditorData>>;

export function AptitudePanel({ initial }: { initial: EditorData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aptitude, setAptitude] = useState(initial.aptitude);

  useEffect(() => {
    setAptitude(initial.aptitude);
  }, [initial.aptitude.spiritualRoot]);

  const save = (next: Aptitude) => {
    setAptitude(next);
    startTransition(async () => {
      await updateAptitude(next);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardDescription>Hidden Talent</CardDescription>
      <CardTitle className="mb-3">主角隐藏资质</CardTitle>
      <div className="grid grid-cols-2 gap-2">
        <SpiritualRootPicker
          aptitude={aptitude}
          fiveElements={initial.fiveElements}
          spiritualRootCountOptions={initial.spiritualRootCountOptions}
          disabled={pending}
        />
        {initial.aptitudeFields.map((field) => (
          <label key={field.key} className="grid gap-1 text-xs font-bold text-[#6f6559]">
            {field.label}
            <input
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              className="min-h-8 rounded-md border border-[#d7c7aa] bg-[#fffdf7] px-2 text-sm"
              value={aptitude[field.key as keyof Aptitude] as number}
              disabled={pending}
              onChange={(e) => {
                const value = Number(e.target.value);
                save({ ...aptitude, [field.key]: value } as Aptitude);
              }}
            />
          </label>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-[#d7c7aa]/80 bg-[rgba(255,250,240,0.7)] p-3">
        <h3 className="mb-2 text-sm font-bold">成长模型</h3>
        <dl className="grid grid-cols-[1fr_auto] gap-2 text-sm">
          {(
            [
              ["HP成长", `${initial.progression.hpGrowth}x`],
              ["攻击成长", `${initial.progression.attackGrowth}x`],
              ["防御成长", `${initial.progression.defenseGrowth}x`],
              ["灵力成长", `${initial.progression.spiritualGrowth}x`],
              ["神识成长", `${initial.progression.divineSenseGrowth}x`],
              ["资源消耗", `${initial.progression.resourceCostMultiplier}x`],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-[#6f6559]">{label}</dt>
              <dd className="font-extrabold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}
