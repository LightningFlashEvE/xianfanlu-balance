"use client";

import { useId, useRef } from "react";
import type { SandboxPowerDisplay } from "@/lib/sandbox-combat";

type Props = {
  variant: "hero" | "enemy";
  power: SandboxPowerDisplay & { enabledManualCount?: number; potentialMultiplier?: number };
  pending?: boolean;
};

const variantStyles = {
  hero: {
    border: "border-[#1f7a69]/35",
    bg: "bg-[linear-gradient(135deg,rgba(31,122,105,0.12),rgba(255,252,245,0.96))]",
    hover: "hover:border-[#1f7a69]/55",
    title: "text-[#1a4f45]",
    label: "主角实时战力",
  },
  enemy: {
    border: "border-[#8b4513]/35",
    bg: "bg-[linear-gradient(135deg,rgba(139,69,19,0.1),rgba(255,252,245,0.96))]",
    hover: "hover:border-[#8b4513]/55",
    title: "text-[#5c3a1e]",
    label: "敌方实时战力",
  },
} as const;

export function SandboxPowerCard({ variant, power, pending }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const style = variantStyles[variant];

  const subtitle =
    variant === "hero"
      ? `${power.realmName} ×${power.realmMultiplier} · ${power.equipmentCount} 装 / ${power.enabledManualCount ?? 0} 功法`
      : `${power.realmName} ×${power.realmMultiplier}${
          Math.abs(power.templateScale - 1) > 0.001 ? ` · 模板 ${power.templateScale}×` : ""
        } · ${power.equipmentCount} 装`;

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => dialogRef.current?.showModal()}
        className={`grid w-full gap-1 rounded-lg border p-3 text-left transition disabled:opacity-60 ${style.border} ${style.bg} ${style.hover}`}
        aria-haspopup="dialog"
      >
        <span className="text-xs font-bold text-[#6f6559]">{style.label}</span>
        <strong className={`text-2xl tracking-tight ${style.title}`}>{power.totalLabel}</strong>
        <small className="text-xs text-[#6f6559]">{subtitle} · 点击查看计算过程</small>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto max-h-[min(85vh,640px)] w-[min(520px,calc(100vw-2rem))] max-w-lg rounded-xl border border-[#d7c7aa] bg-[#fffdf7] p-0 shadow-xl backdrop:bg-black/40"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current.close();
        }}
      >
        <div className="border-b border-[#d7c7aa]/80 px-4 py-3">
          <h2 id={titleId} className="text-base font-extrabold text-[#252019]">
            {variant === "hero" ? "主角" : "敌方"}战力计算过程
          </h2>
          <p className="mt-1 text-xs text-[#6f6559]">
            总评 {power.totalLabel}（精确值 {formatRaw(power.total)}）
          </p>
        </div>
        <ol className="max-h-[min(60vh,480px)] list-none overflow-y-auto px-4 py-3">
          {power.steps.map((step, index) => (
            <li
              key={step.label}
              className="border-b border-[#d7c7aa]/50 py-2.5 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="shrink-0 text-xs font-bold text-[#6f6559]">
                  {index + 1}. {step.label}
                </span>
                <span className="text-right text-sm font-extrabold text-[#252019]">{step.value}</span>
              </div>
              {step.detail ? (
                <p className="mt-1 text-xs leading-relaxed text-[#6f6559]">{step.detail}</p>
              ) : null}
            </li>
          ))}
        </ol>
        <div className="flex justify-end border-t border-[#d7c7aa]/80 px-4 py-3">
          <button
            type="button"
            className="rounded-md border border-[#d7c7aa] bg-white px-3 py-1.5 text-sm font-bold text-[#252019] hover:bg-[#faf6ee]"
            onClick={() => dialogRef.current?.close()}
          >
            关闭
          </button>
        </div>
      </dialog>
    </>
  );
}

function formatRaw(value: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value);
}
