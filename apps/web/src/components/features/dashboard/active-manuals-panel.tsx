"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  listManualActivation,
  setManualEnabled,
  setManualProficiency,
  setManualsEnabled,
} from "@/actions/evaluator";
import { manualRankOptions, proficiencyOptions } from "@/lib/game-meta";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ManualRow = Awaited<ReturnType<typeof listManualActivation>>[number];

const ALL_TYPE = "全部";
const ALL_RANK = "全部";

function sortRanks(ranks: string[]) {
  const order = new Map(manualRankOptions.map((r, i) => [r, i]));
  return [...ranks].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999) || a.localeCompare(b, "zh"));
}

function matchesQuery(manual: ManualRow, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${manual.name} ${manual.externalId} ${manual.type} ${manual.rank} ${manual.quality}`.toLowerCase();
  return haystack.includes(q);
}

export function ActiveManualsPanel({
  initial,
  embedded = false,
  onCombatChange,
}: {
  initial: ManualRow[];
  embedded?: boolean;
  /** 沙盘：勾选/熟练度变更后重算对战与战力 */
  onCombatChange?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [manuals, setManuals] = useState(initial);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL_TYPE);
  const [rankFilter, setRankFilter] = useState(ALL_RANK);
  const [enabledOnly, setEnabledOnly] = useState(false);

  const typeFacets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of manuals) {
      counts.set(m.type, (counts.get(m.type) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh"));
  }, [manuals]);

  const rankOptions = useMemo(() => {
    const ranks = new Set(manuals.map((m) => m.rank));
    return sortRanks([...ranks]);
  }, [manuals]);

  const filtered = useMemo(() => {
    return manuals.filter((m) => {
      if (enabledOnly && !m.enabled) return false;
      if (typeFilter !== ALL_TYPE && m.type !== typeFilter) return false;
      if (rankFilter !== ALL_RANK && m.rank !== rankFilter) return false;
      return matchesQuery(m, query);
    });
  }, [manuals, enabledOnly, typeFilter, rankFilter, query]);

  const enabledCount = manuals.filter((m) => m.enabled).length;

  const afterManualPersist = async () => {
    await onCombatChange?.();
    router.refresh();
  };

  const toggle = (id: number, enabled: boolean) => {
    setManuals((rows) => rows.map((row) => (row.id === id ? { ...row, enabled } : row)));
    startTransition(async () => {
      await setManualEnabled(id, enabled);
      await afterManualPersist();
    });
  };

  const changeProficiency = (id: number, proficiency: string) => {
    setManuals((rows) => rows.map((row) => (row.id === id ? { ...row, proficiency } : row)));
    startTransition(async () => {
      await setManualProficiency(id, proficiency);
      await afterManualPersist();
    });
  };

  const bulkSet = (ids: number[], enabled: boolean) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setManuals((rows) => rows.map((row) => (idSet.has(row.id) ? { ...row, enabled } : row)));
    startTransition(async () => {
      await setManualsEnabled(ids, enabled);
      await afterManualPersist();
    });
  };

  const bulkEnableFiltered = () => bulkSet(filtered.map((m) => m.id), true);
  const bulkDisableFiltered = () => bulkSet(filtered.map((m) => m.id), false);

  const body = (
    <>
      {!embedded ? (
        <>
          <CardDescription>Evaluation Loadout</CardDescription>
          <CardTitle className="mb-1">功法实验台</CardTitle>
        </>
      ) : (
        <h4 className="mb-1 text-sm font-extrabold text-[#252019]">功法</h4>
      )}
      <p className="mb-3 text-xs text-[#6f6559]">
        {embedded
          ? "勾选参与主角对战加成，不占背包格；与评估页标准养成无关。"
          : "勾选仅影响本页沙盘对战中的功法加成。评估器页的总评与曲线使用数值管理中装备的「合理大境界段」与功法「可修至境界」，与此处无关。"}
      </p>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">搜索功法</span>
          <input
            type="search"
            placeholder="搜索名称、编号（如 M001）、种类、等阶…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full min-h-9 rounded-md border border-[#d7c7aa] bg-[#fffdf7] px-3 py-2 pr-8 text-sm outline-none focus:border-[#1f7a69]/60 focus:ring-2 focus:ring-[#1f7a69]/15"
          />
          {query ? (
            <button
              type="button"
              aria-label="清空搜索"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-xs text-[#6f6559] hover:bg-[#fffaf0]"
              onClick={() => setQuery("")}
            >
              ✕
            </button>
          ) : null}
        </label>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-[#6f6559]">
          <input
            type="checkbox"
            className="rounded border-[#d7c7aa]"
            checked={enabledOnly}
            onChange={(e) => setEnabledOnly(e.target.checked)}
          />
          仅看已启用
        </label>
      </div>

      <div className="mb-2">
        <p className="mb-1.5 text-xs font-bold text-[#6f6559]">种类</p>
        <div className="flex flex-wrap gap-1.5">
          <TypeChip
            label={ALL_TYPE}
            count={manuals.length}
            active={typeFilter === ALL_TYPE}
            onClick={() => setTypeFilter(ALL_TYPE)}
          />
          {typeFacets.map(([type, count]) => (
            <TypeChip
              key={type}
              label={type}
              count={count}
              active={typeFilter === type}
              onClick={() => setTypeFilter(type)}
            />
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs font-bold text-[#6f6559]">
          等阶
          <select
            className="min-h-8 rounded-md border border-[#d7c7aa] bg-[#fffdf7] px-2 text-sm font-normal"
            value={rankFilter}
            onChange={(e) => setRankFilter(e.target.value)}
          >
            <option value={ALL_RANK}>{ALL_RANK}</option>
            {rankOptions.map((rank) => (
              <option key={rank} value={rank}>
                {rank}
              </option>
            ))}
          </select>
        </label>
        {(typeFilter !== ALL_TYPE || rankFilter !== ALL_RANK || query || enabledOnly) && (
          <button
            type="button"
            className="text-xs text-[#2f5e9e] underline-offset-2 hover:underline"
            onClick={() => {
              setQuery("");
              setTypeFilter(ALL_TYPE);
              setRankFilter(ALL_RANK);
              setEnabledOnly(false);
            }}
          >
            清除筛选
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-[#15584c]">
          已启用 {enabledCount} / {manuals.length} 本
          {filtered.length !== manuals.length ? (
            <span className="ml-2 font-normal text-[#6f6559]">· 当前显示 {filtered.length} 本</span>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || filtered.length === 0}
            onClick={bulkEnableFiltered}
          >
            当前筛选全选
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || filtered.length === 0}
            onClick={bulkDisableFiltered}
          >
            当前筛选全清
          </Button>
        </div>
      </div>

      <div
        className={`overflow-y-auto rounded-md border border-[#d7c7aa]/60 bg-[#fffdf7]/50 p-2 ${embedded ? "max-h-64" : "max-h-[min(28rem,55vh)]"}`}
      >
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-[#6f6559]">没有匹配的功法，请调整筛选或搜索关键词。</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((manual) => (
              <div
                key={manual.id}
                className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  manual.enabled
                    ? "border-[#1f7a69]/40 bg-[#1f7a69]/8"
                    : "border-[#d7c7aa]/80 bg-[#fffdf7]"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 shrink-0 cursor-pointer"
                  checked={manual.enabled}
                  disabled={pending}
                  aria-label={`启用 ${manual.name}`}
                  onChange={(e) => toggle(manual.id, e.target.checked)}
                />
                <div className="min-w-0 flex-1">
                  <strong className="block truncate">{manual.name}</strong>
                  <span className="text-xs text-[#6f6559]">
                    {manual.externalId} · {manual.type} · {manual.rank}
                  </span>
                  <label className="mt-1.5 grid gap-0.5">
                    <span className="text-[11px] font-bold text-[#6f6559]">熟练度</span>
                    <select
                      className="min-h-7 w-full rounded-md border border-[#d7c7aa] bg-white px-1.5 text-xs"
                      value={manual.proficiency}
                      disabled={pending}
                      onChange={(e) => changeProficiency(manual.id, e.target.value)}
                    >
                      {proficiencyOptions.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  if (embedded) return body;
  return <Card>{body}</Card>;
}

function TypeChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs font-bold transition-colors ${
        active
          ? "border-[#1f7a69] bg-[#1f7a69]/12 text-[#15584c]"
          : "border-[#d7c7aa] bg-[#fffdf7] text-[#6f6559] hover:border-[#1f7a69]/35"
      }`}
    >
      {label}
      <span className="ml-1 font-normal opacity-80">{count}</span>
    </button>
  );
}
