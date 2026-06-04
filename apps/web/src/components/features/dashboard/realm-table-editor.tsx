"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { analyzeCurve, diagnoseJump, formatNumber } from "@xianfanlu/core";
import { updateRealmMultiplier } from "@/actions/balance";
import { updateHeroRealm } from "@/actions/hero";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type RealmRow = { id: number; name: string; multiplier: number };

type Props = {
  initialRealms: RealmRow[];
  initialHeroRealm: string;
};

export function RealmTableEditor({ initialRealms, initialHeroRealm }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [realms, setRealms] = useState(initialRealms);
  const [heroRealm, setHeroRealm] = useState(initialHeroRealm);

  const curve = useMemo(
    () => analyzeCurve(realms.map((r) => ({ name: r.name, multiplier: r.multiplier }))),
    [realms],
  );

  const saveMultiplier = (id: number, value: number) => {
    const multiplier = Math.max(value, 0.0001);
    setRealms((rows) => rows.map((row) => (row.id === id ? { ...row, multiplier } : row)));
    startTransition(async () => {
      await updateRealmMultiplier(id, multiplier);
      router.refresh();
    });
  };

  const saveHeroRealm = (name: string) => {
    setHeroRealm(name);
    startTransition(async () => {
      await updateHeroRealm(name);
      router.refresh();
    });
  };

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardDescription>Realm Curve</CardDescription>
          <CardTitle>境界倍率</CardTitle>
        </div>
        <label className="grid gap-1 text-xs font-bold text-[#6f6559]">
          主角层级
          <select
            className="min-h-9 min-w-[132px] rounded-md border border-[#d7c7aa] bg-[#fffdf7] px-2 text-sm"
            value={heroRealm}
            disabled={pending}
            onChange={(e) => saveHeroRealm(e.target.value)}
          >
            {realms.map((realm) => (
              <option key={realm.id} value={realm.name}>
                {realm.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs font-extrabold text-[#6f6559]">
              <th className="border-b border-[#d7c7aa]/70 px-2 py-2">层级</th>
              <th className="border-b border-[#d7c7aa]/70 px-2 py-2">倍率</th>
              <th className="border-b border-[#d7c7aa]/70 px-2 py-2">相邻增幅</th>
              <th className="border-b border-[#d7c7aa]/70 px-2 py-2">诊断</th>
            </tr>
          </thead>
          <tbody>
            {realms.map((realm, index) => {
              const prev = realms[index - 1];
              const jump = prev ? realm.multiplier / Math.max(prev.multiplier, 0.0001) : null;
              const diag = jump ? diagnoseJump(jump) : { label: "基准", level: "soft" as const };
              return (
                <tr key={realm.id}>
                  <td className="border-b border-[#d7c7aa]/70 px-2 py-2">{realm.name}</td>
                  <td className="border-b border-[#d7c7aa]/70 px-2 py-2">
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      className="w-full min-h-8 rounded-md border border-[#d7c7aa] bg-[#fffdf7] px-2 text-sm"
                      value={realm.multiplier}
                      disabled={pending}
                      onChange={(e) => saveMultiplier(realm.id, Number(e.target.value))}
                    />
                  </td>
                  <td className="border-b border-[#d7c7aa]/70 px-2 py-2">
                    {jump ? `${formatNumber(jump, 2)}x` : "--"}
                  </td>
                  <td className="border-b border-[#d7c7aa]/70 px-2 py-2">
                    <span
                      className={
                        diag.level === "danger"
                          ? "text-[#a94435]"
                          : diag.level === "warn"
                            ? "text-[#b7832d]"
                            : diag.level === "good"
                              ? "text-[#1f7a69]"
                              : "text-[#2f5e9e]"
                      }
                    >
                      {diag.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[#6f6559]">
        曲线评价：{curve.grade} — {curve.summary}
      </p>
    </Card>
  );
}
