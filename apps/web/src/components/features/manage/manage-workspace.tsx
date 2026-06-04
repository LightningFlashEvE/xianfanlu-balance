"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  addEquipment,
  addManual,
  deleteEquipment,
  deleteManual,
  getManageData,
  updateEquipment,
  updateManual,
} from "@/actions/manage";
import type { BalanceRealmBandId, ItemQualityId, RealmName } from "@xianfanlu/core";
import { formatEquipmentTypeLabel, getEquipmentDomainLabel } from "@xianfanlu/core";
import {
  equipmentTaxonomyGroups,
  itemQualityOptions,
  manualRankOptions,
  manualTypeOptions,
  proficiencyOptions,
} from "@/lib/game-meta";
import { EquipmentTypePicker } from "./equipment-type-picker";
import { ManageListToolbar } from "./manage-list-toolbar";
import { EffectEditor } from "./effect-editor";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ManageData = Awaited<ReturnType<typeof getManageData>>;
type EquipmentGroupMode = "none" | "domain" | "type" | "quality" | "balanceRealm";
type ManualGroupMode = "none" | "type" | "rank" | "quality" | "maxRealm";

const equipmentGroupOptions: { value: EquipmentGroupMode; label: string }[] = [
  { value: "none", label: "不分组" },
  { value: "domain", label: "按策划大类" },
  { value: "type", label: "按详细类型" },
  { value: "quality", label: "按品阶" },
  { value: "balanceRealm", label: "按合理大境界段" },
];

const manualGroupOptions: { value: ManualGroupMode; label: string }[] = [
  { value: "none", label: "不分组" },
  { value: "type", label: "按种类" },
  { value: "rank", label: "按等阶" },
  { value: "quality", label: "按品阶" },
  { value: "maxRealm", label: "按可修至境界" },
];

export function ManageWorkspace({ initial }: { initial: ManageData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [equipment, setEquipment] = useState(initial.equipment);
  const [manuals, setManuals] = useState(initial.manuals);
  const [equipmentGroupMode, setEquipmentGroupMode] = useState<EquipmentGroupMode>("none");
  const [manualGroupMode, setManualGroupMode] = useState<ManualGroupMode>("none");
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [manualSearch, setManualSearch] = useState("");
  const [taxonomyOpen, setTaxonomyOpen] = useState(false);

  const run = (fn: () => Promise<void>) => {
    startTransition(async () => {
      await fn();
      const fresh = await getManageData();
      setEquipment(fresh.equipment);
      setManuals(fresh.manuals);
      router.refresh();
    });
  };

  const saveEquipment = (id: number, patch: Parameters<typeof updateEquipment>[1]) => {
    setEquipment((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    run(() => updateEquipment(id, patch));
  };

  const saveManual = (id: number, patch: Parameters<typeof updateManual>[1]) => {
    setManuals((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    run(() => updateManual(id, patch));
  };

  const filteredEquipment = useMemo(() => {
    const q = equipmentSearch.trim().toLowerCase();
    if (!q) return equipment;
    return equipment.filter((item) => {
      const haystack =
        `${item.name} ${item.externalId} ${formatEquipmentTypeLabel(item.slot, item.category)} ${item.quality} ${item.balanceRealm} ${getEquipmentDomainLabel(item.slot)}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [equipment, equipmentSearch]);

  const filteredManuals = useMemo(() => {
    const q = manualSearch.trim().toLowerCase();
    if (!q) return manuals;
    return manuals.filter((item) => {
      const haystack =
        `${item.name} ${item.externalId} ${item.type} ${item.rank} ${item.quality} ${item.maxRealm} ${item.proficiency}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [manuals, manualSearch]);

  const equipmentGroupChips = useMemo(
    () => groupItems(filteredEquipment, equipmentGroupMode, "equipment"),
    [filteredEquipment, equipmentGroupMode],
  );
  const manualGroupChips = useMemo(
    () => groupItems(filteredManuals, manualGroupMode, "manual"),
    [filteredManuals, manualGroupMode],
  );

  return (
    <div className="grid gap-4">
      <Card>
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => setTaxonomyOpen((v) => !v)}
        >
          <div>
            <CardDescription>Taxonomy</CardDescription>
            <CardTitle className="text-base">物品范围说明</CardTitle>
          </div>
          <span className="text-sm text-[#6f6559]">{taxonomyOpen ? "收起" : "展开"}</span>
        </button>
        {taxonomyOpen ? (
          <div className="mt-3 grid gap-3 text-sm text-[#6f6559]">
            <p>
              <strong className="text-[#252019]">功法武学</strong>：独立条目，无部位；评估按「可修至境界」累计。
            </p>
            {equipmentTaxonomyGroups.map((g) => (
              <div key={g.id} className="rounded-md border border-[#d7c7aa]/60 bg-[#fffdf7] px-3 py-2">
                <p className="font-bold text-[#15584c]">
                  {g.label}
                  <span className="ml-2 font-normal text-[#6f6559]">（{g.slots.join("、")}）</span>
                </p>
                <p className="mt-1">{g.description}</p>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="mb-1 flex items-center justify-between gap-2">
          <div>
            <CardDescription>Equipment</CardDescription>
            <CardTitle>装备与外物</CardTitle>
          </div>
          <Button type="button" variant="outline" disabled={pending} onClick={() => run(addEquipment)}>
            添加装备
          </Button>
        </div>
        <ManageListToolbar
          groupLabel="装备分组"
          groupValue={equipmentGroupMode}
          groupOptions={equipmentGroupOptions}
          onGroupChange={(v) => setEquipmentGroupMode(v as EquipmentGroupMode)}
          searchPlaceholder="名称、ID、类型、品阶、大境界段…"
          searchValue={equipmentSearch}
          onSearchChange={setEquipmentSearch}
          filteredCount={filteredEquipment.length}
          totalCount={equipment.length}
          chips={equipmentGroupChips}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs font-extrabold text-[#6f6559]">
                <th className="border-b px-2 py-2">名称</th>
                <th className="border-b px-2 py-2">类型</th>
                <th className="border-b px-2 py-2">品阶</th>
                <th className="border-b px-2 py-2">合理境界段</th>
                <th className="border-b px-2 py-2">战斗影响</th>
                <th className="border-b px-2 py-2">成长影响</th>
                <th className="border-b px-2 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {renderGroups(filteredEquipment, equipmentGroupMode, "equipment", (item) => (
                <tr key={item.id}>
                  <td className="border-b px-2 py-2">
                    <input
                      className="w-full min-h-8 rounded-md border border-[#d7c7aa] px-2 text-sm"
                      value={item.name}
                      disabled={pending}
                      onChange={(e) => saveEquipment(item.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="border-b px-2 py-2">
                    <EquipmentTypePicker
                      slot={item.slot}
                      category={item.category}
                      disabled={pending}
                      onChange={(slot, category) => saveEquipment(item.id, { slot, category })}
                    />
                  </td>
                  <td className="border-b px-2 py-2">
                    <select
                      className="w-full min-h-8 rounded-md border border-[#d7c7aa] px-1 text-sm"
                      value={item.quality}
                      disabled={pending}
                      onChange={(e) =>
                        saveEquipment(item.id, { quality: e.target.value as ItemQualityId })
                      }
                    >
                      {itemQualityOptions.map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-b px-2 py-2">
                    <select
                      className="w-full min-h-8 rounded-md border border-[#d7c7aa] px-1 text-sm"
                      value={item.balanceRealm}
                      disabled={pending}
                      onChange={(e) =>
                        saveEquipment(item.id, {
                          balanceRealm: e.target.value as BalanceRealmBandId,
                        })
                      }
                    >
                      {initial.balanceRealmBands.map((band) => (
                        <option key={band.id} value={band.id}>
                          {band.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-b px-2 py-2 min-w-[220px]">
                    <EffectEditor
                      group="combat"
                      effects={item.combat}
                      onChange={(combat) => saveEquipment(item.id, { combat })}
                    />
                  </td>
                  <td className="border-b px-2 py-2 min-w-[220px]">
                    <EffectEditor
                      group="growth"
                      effects={item.growth}
                      onChange={(growth) => saveEquipment(item.id, { growth })}
                    />
                  </td>
                  <td className="border-b px-2 py-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => deleteEquipment(item.id))}
                    >
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[#6f6559]">
          「合理境界段」为大境界（凡俗期、江湖期、炼气期等）。主角细境界映射到大期后，累计该大期及之前装备（同部位取最高大期）。
        </p>
      </Card>

      <Card>
        <div className="mb-1 flex items-center justify-between gap-2">
          <div>
            <CardDescription>Manuals</CardDescription>
            <CardTitle>功法与武学</CardTitle>
          </div>
          <Button type="button" variant="outline" disabled={pending} onClick={() => run(addManual)}>
            添加功法
          </Button>
        </div>
        <ManageListToolbar
          groupLabel="功法分组"
          groupValue={manualGroupMode}
          groupOptions={manualGroupOptions}
          onGroupChange={(v) => setManualGroupMode(v as ManualGroupMode)}
          searchPlaceholder="名称、ID、种类、等阶、品阶、可修至境界…"
          searchValue={manualSearch}
          onSearchChange={setManualSearch}
          filteredCount={filteredManuals.length}
          totalCount={manuals.length}
          chips={manualGroupChips}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs font-extrabold text-[#6f6559]">
                <th className="border-b px-2 py-2">名称</th>
                <th className="border-b px-2 py-2">等阶</th>
                <th className="border-b px-2 py-2">品阶</th>
                <th className="border-b px-2 py-2">种类</th>
                <th className="border-b px-2 py-2">熟练度</th>
                <th className="border-b px-2 py-2">可修至境界</th>
                <th className="border-b px-2 py-2">战斗影响</th>
                <th className="border-b px-2 py-2">成长影响</th>
                <th className="border-b px-2 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {renderGroups(filteredManuals, manualGroupMode, "manual", (item) => (
                <tr key={item.id}>
                  <td className="border-b px-2 py-2">
                    <input
                      className="w-full min-h-8 rounded-md border border-[#d7c7aa] px-2 text-sm"
                      value={item.name}
                      disabled={pending}
                      onChange={(e) => saveManual(item.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="border-b px-2 py-2">
                    <select
                      className="w-full min-h-8 rounded-md border border-[#d7c7aa] px-1 text-sm"
                      value={item.rank}
                      disabled={pending}
                      onChange={(e) => saveManual(item.id, { rank: e.target.value })}
                    >
                      {manualRankOptions.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-b px-2 py-2">
                    <select
                      className="w-full min-h-8 rounded-md border border-[#d7c7aa] px-1 text-sm"
                      value={item.quality}
                      disabled={pending}
                      onChange={(e) =>
                        saveManual(item.id, { quality: e.target.value as ItemQualityId })
                      }
                    >
                      {itemQualityOptions.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-b px-2 py-2">
                    <select
                      className="w-full min-h-8 rounded-md border border-[#d7c7aa] px-1 text-sm"
                      value={item.type}
                      disabled={pending}
                      onChange={(e) => saveManual(item.id, { type: e.target.value })}
                    >
                      {manualTypeOptions.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-b px-2 py-2">
                    <select
                      className="w-full min-h-8 rounded-md border border-[#d7c7aa] px-1 text-sm"
                      value={item.proficiency}
                      disabled={pending}
                      onChange={(e) => saveManual(item.id, { proficiency: e.target.value })}
                    >
                      {proficiencyOptions.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-b px-2 py-2">
                    <select
                      className="w-full min-h-8 rounded-md border border-[#d7c7aa] px-1 text-sm"
                      value={item.maxRealm}
                      disabled={pending}
                      onChange={(e) =>
                        saveManual(item.id, { maxRealm: e.target.value as RealmName })
                      }
                    >
                      {initial.realmNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-b px-2 py-2 min-w-[220px]">
                    <EffectEditor
                      group="combat"
                      effects={item.combat}
                      onChange={(combat) => saveManual(item.id, { combat })}
                    />
                  </td>
                  <td className="border-b px-2 py-2 min-w-[220px]">
                    <EffectEditor
                      group="growth"
                      effects={item.growth}
                      onChange={(growth) => saveManual(item.id, { growth })}
                    />
                  </td>
                  <td className="border-b px-2 py-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => deleteManual(item.id))}
                    >
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[#6f6559]">
          评估页标准养成按「可修至境界」累计（15 细境界）；熟练度影响效果缩放。功法无单独等级字段。
        </p>
      </Card>
    </div>
  );
}

function equipmentGroupLabel(item: ManageData["equipment"][0], mode: EquipmentGroupMode) {
  if (mode === "none") return "";
  if (mode === "domain") return getEquipmentDomainLabel(item.slot);
  if (mode === "type") return formatEquipmentTypeLabel(item.slot, item.category);
  if (mode === "quality") return item.quality;
  if (mode === "balanceRealm") return item.balanceRealm;
  return "其他";
}

function manualGroupLabel(item: ManageData["manuals"][0], mode: ManualGroupMode) {
  if (mode === "none") return "";
  if (mode === "type") return item.type;
  if (mode === "rank") return item.rank;
  if (mode === "quality") return item.quality;
  if (mode === "maxRealm") return item.maxRealm;
  return "其他";
}

function groupItems<T extends ManageData["equipment"][0] | ManageData["manuals"][0]>(
  items: T[],
  mode: EquipmentGroupMode | ManualGroupMode,
  kind: "equipment" | "manual",
) {
  if (mode === "none") return [];
  const counts = new Map<string, number>();
  for (const item of items) {
    const label =
      kind === "equipment"
        ? equipmentGroupLabel(item as ManageData["equipment"][0], mode as EquipmentGroupMode)
        : manualGroupLabel(item as ManageData["manuals"][0], mode as ManualGroupMode);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

function renderGroups<T extends ManageData["equipment"][0] | ManageData["manuals"][0]>(
  items: T[],
  mode: EquipmentGroupMode | ManualGroupMode,
  kind: "equipment" | "manual",
  renderRow: (item: T) => ReactNode,
) {
  if (mode === "none") {
    return items.length === 0 ? (
      <tr>
        <td colSpan={kind === "equipment" ? 7 : 9} className="px-3 py-6 text-center text-sm text-[#6f6559]">
          无匹配条目
        </td>
      </tr>
    ) : (
      items.map((item) => renderRow(item))
    );
  }

  const labelFor = (item: T) =>
    kind === "equipment"
      ? equipmentGroupLabel(item as ManageData["equipment"][0], mode as EquipmentGroupMode)
      : manualGroupLabel(item as ManageData["manuals"][0], mode as ManualGroupMode);

  const sorted = [...items].sort((a, b) => labelFor(a).localeCompare(labelFor(b), "zh-CN"));
  if (sorted.length === 0) {
    return (
      <tr>
        <td colSpan={kind === "equipment" ? 7 : 9} className="px-3 py-6 text-center text-sm text-[#6f6559]">
          无匹配条目
        </td>
      </tr>
    );
  }

  let current = "";
  const nodes: ReactNode[] = [];
  const colSpan = kind === "equipment" ? 7 : 9;
  for (const item of sorted) {
    const label = labelFor(item);
    if (label !== current) {
      current = label;
      const count = items.filter((i) => labelFor(i) === label).length;
      nodes.push(
        <tr key={`group-${label}`}>
          <td colSpan={colSpan} className="bg-[#1f7a69]/8 px-3 py-2 text-sm font-extrabold text-[#15584c]">
            {label} <span className="text-xs text-[#6f6559]">{count} 项</span>
          </td>
        </tr>,
      );
    }
    nodes.push(renderRow(item));
  }
  return nodes;
}
