"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  findMatchingSandboxEnemyPreset,
  validateLoadout,
  type EquipmentInstance,
  type ResolvedSandboxEnemyPreset,
} from "@xianfanlu/core";
import {
  getSandboxData,
  recalculateSandboxCombat,
  updateSandboxConfig,
  type SandboxConfigUpdate,
} from "@/actions/sandbox";
import { ActiveManualsPanel } from "@/components/features/dashboard/active-manuals-panel";
import { CharacterLoadoutPanel } from "./character-loadout-panel";
import { SandboxEnemyPresets } from "./sandbox-enemy-presets";
import { SandboxEnemyPowerCard } from "./sandbox-enemy-power-card";
import { SandboxHeroPowerCard } from "./sandbox-hero-power-card";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type SandboxData = Awaited<ReturnType<typeof getSandboxData>>;
type ManualRow = SandboxData["manuals"][number];

type Props = {
  initial: SandboxData;
  equipmentInstances: EquipmentInstance[];
};

export function SandboxPanel({ initial, equipmentInstances }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [config, setConfig] = useState(initial.config);
  const [duel, setDuel] = useState(initial.duel);
  const [heroPower, setHeroPower] = useState(initial.heroPower);
  const [enemyPower, setEnemyPower] = useState(initial.enemyPower);
  const [message, setMessage] = useState<{ hero: string; enemy: string }>({ hero: "", enemy: "" });

  useEffect(() => {
    setDuel(initial.duel);
    setHeroPower(initial.heroPower);
    setEnemyPower(initial.enemyPower);
  }, [initial]);

  const applyCombat = useCallback((result: Awaited<ReturnType<typeof recalculateSandboxCombat>>) => {
    setDuel(result.duel);
    setHeroPower(result.heroPower);
    setEnemyPower(result.enemyPower);
  }, []);

  const refreshCombat = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await recalculateSandboxCombat();
        applyCombat(result);
      } catch (err) {
        setMessage({
          hero: err instanceof Error ? err.message : "重算失败",
          enemy: "",
        });
      }
    });
  }, [applyCombat]);

  const persist = useCallback(
    (update: SandboxConfigUpdate, nextConfig?: typeof config) => {
      startTransition(async () => {
        try {
          const result = await updateSandboxConfig(update);
          applyCombat(result);
          if (nextConfig) setConfig(nextConfig);
          setMessage({ hero: "", enemy: "" });
          router.refresh();
        } catch (err) {
          setMessage({
            hero: err instanceof Error ? err.message : "保存失败",
            enemy: "",
          });
        }
      });
    },
    [router, applyCombat],
  );

  const activeEnemyPreset = findMatchingSandboxEnemyPreset(initial.enemyPresets, {
    defenderRealm: config.defenderRealm,
    enemyEquipmentIds: config.enemyEquipmentIds,
    enemyTemplateScale: config.enemyTemplateScale,
  });

  const applyEnemyPreset = (preset: ResolvedSandboxEnemyPreset) => {
    const check = validateLoadout(equipmentInstances, preset.enemyEquipmentIds, config.baseBagCapacity);
    if (!check.valid) {
      setMessage((m) => ({ ...m, enemy: check.message }));
      return;
    }
    const next = {
      ...config,
      defenderRealm: preset.defenderRealm,
      enemyEquipmentIds: preset.enemyEquipmentIds,
      enemyTemplateScale: preset.enemyTemplateScale,
    };
    setConfig(next);
    persist(
      {
        defenderRealm: preset.defenderRealm,
        enemyEquipmentIds: preset.enemyEquipmentIds,
        enemyTemplateScale: preset.enemyTemplateScale,
      },
      next,
    );
  };

  const setLoadout = (side: "hero" | "enemy", ids: string[]) => {
    const key = side === "hero" ? "heroEquipmentIds" : "enemyEquipmentIds";
    const check = validateLoadout(equipmentInstances, ids, config.baseBagCapacity);
    if (!check.valid) {
      setMessage((m) => ({ ...m, [side]: check.message }));
      return;
    }
    const next = { ...config, [key]: ids };
    setConfig(next);
    persist({ [key]: ids }, next);
  };

  return (
    <Card className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardDescription>Combat Sandbox</CardDescription>
          <CardTitle>对战沙盘</CardTitle>
          <p className="mt-1 max-w-xl text-xs text-[#6f6559]">
            按游戏式装备栏配装；功法在主角装备栏下方勾选，不计入背包格。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <RealmSelect
            label="主角境界"
            value={config.attackerRealm}
            realms={initial.realms}
            pending={pending}
            onChange={(attackerRealm) => {
              const next = { ...config, attackerRealm };
              setConfig(next);
              persist({ attackerRealm }, next);
            }}
          />
          <RealmSelect
            label="敌方境界"
            value={config.defenderRealm}
            realms={initial.realms}
            pending={pending}
            onChange={(defenderRealm) => {
              const next = { ...config, defenderRealm };
              setConfig(next);
              persist({ defenderRealm }, next);
            }}
          />
          <label className="grid gap-1 text-xs font-bold text-[#6f6559]">
            敌方模板强度
            <input
              type="number"
              min={0.2}
              max={3}
              step={0.1}
              className="min-h-9 w-24 rounded-md border border-[#d7c7aa] bg-[#fffdf7] px-2 text-sm"
              value={config.enemyTemplateScale}
              disabled={pending}
              onChange={(e) => {
                const v = Number(e.target.value);
                const next = { ...config, enemyTemplateScale: v };
                setConfig(next);
                persist({ enemyTemplateScale: v }, next);
              }}
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#6f6559]">
            基础背包容量
            <input
              type="number"
              min={1}
              step={1}
              className="min-h-9 w-24 rounded-md border border-[#d7c7aa] bg-[#fffdf7] px-2 text-sm"
              value={config.baseBagCapacity}
              disabled={pending}
              onChange={(e) => {
                const v = Number(e.target.value);
                const next = { ...config, baseBagCapacity: v };
                setConfig(next);
                persist({ baseBagCapacity: v }, next);
              }}
            />
          </label>
        </div>
      </div>

      <Card className="border-[#d7c7aa]/90 bg-[rgba(255,252,245,0.94)]">
        <CardTitle className="text-sm">AI 平衡报告</CardTitle>
        <CardDescription className="mt-1">
          15 境标准养成扫描、破境/章节 BOSS 守门与 MiniMax 评审已迁至独立页，后台生成不随切页中断。
        </CardDescription>
        <Link
          href="/sandbox/balance-report"
          className="mt-3 inline-block rounded-md border border-[#1f7a69]/50 bg-[#1f7a69] px-3 py-1.5 text-sm font-bold text-white"
        >
          打开平衡报告页
        </Link>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(200px,260px)] lg:items-start">
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <div className="grid gap-3">
            <CharacterLoadoutPanel
              title="主角"
              ids={config.heroEquipmentIds}
              equipment={equipmentInstances}
              baseBagCapacity={config.baseBagCapacity}
              pending={pending}
              message={message.hero}
              onChange={(ids) => setLoadout("hero", ids)}
            />
            <SandboxManualsBlock initial={initial.manuals} onCombatChange={refreshCombat} />
          </div>

          <div className="grid gap-3">
            <SandboxEnemyPresets
              presets={initial.enemyPresets}
              activeBandId={activeEnemyPreset?.bandId}
              pending={pending}
              onApply={applyEnemyPreset}
            />
            <CharacterLoadoutPanel
              title="敌方"
              ids={config.enemyEquipmentIds}
              equipment={equipmentInstances}
              baseBagCapacity={config.baseBagCapacity}
              pending={pending}
              message={message.enemy}
              onChange={(ids) => setLoadout("enemy", ids)}
            />
          </div>
        </div>

        <div className="grid gap-3">
          <SandboxHeroPowerCard power={heroPower} pending={pending} />
          <SandboxEnemyPowerCard power={enemyPower} pending={pending} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DuelCard label="主角击败敌方" value={duel.heroTtk} hint={duel.heroDps} />
        <DuelCard label="敌方击败主角" value={duel.enemyTtk} hint={duel.enemyDps} />
        <DuelCard label="胜率估算" value={duel.winChance} hint={duel.verdict} highlight />
        <DuelCard label="战力差" value={duel.powerGap} hint={duel.powerGapHint} />
      </div>
    </Card>
  );
}

function SandboxManualsBlock({
  initial,
  onCombatChange,
}: {
  initial: ManualRow[];
  onCombatChange: () => void;
}) {
  return (
    <div className="rounded-lg border border-[#d7c7aa]/80 bg-[rgba(255,250,240,0.55)] p-3">
      <ActiveManualsPanel initial={initial} embedded onCombatChange={onCombatChange} />
    </div>
  );
}

function RealmSelect({
  label,
  value,
  realms,
  pending,
  onChange,
}: {
  label: string;
  value: string;
  realms: string[];
  pending: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-[#6f6559]">
      {label}
      <select
        className="min-h-9 min-w-[132px] rounded-md border border-[#d7c7aa] bg-[#fffdf7] px-2 text-sm"
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
      >
        {realms.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function DuelCard({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`grid gap-1 rounded-lg border p-3 ${highlight ? "border-[#1f7a69]/40 bg-[linear-gradient(135deg,rgba(31,122,105,0.11),rgba(255,252,245,0.96))]" : "border-[#d7c7aa]/90 bg-[rgba(255,252,245,0.94)]"}`}
    >
      <span className="text-xs font-bold text-[#6f6559]">{label}</span>
      <strong className="text-xl">{value}</strong>
      <small className="text-xs text-[#6f6559]">{hint}</small>
    </div>
  );
}
