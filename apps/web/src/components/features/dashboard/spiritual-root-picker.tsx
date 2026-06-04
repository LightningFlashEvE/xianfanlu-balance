"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatSpiritualRootLabel, type Aptitude, type FiveElement } from "@xianfanlu/core";
import { updateSpiritualRoot } from "@/actions/hero";

type Props = {
  aptitude: Aptitude;
  fiveElements: readonly FiveElement[];
  spiritualRootCountOptions: readonly number[];
  disabled?: boolean;
};

export function SpiritualRootPicker({
  aptitude,
  fiveElements,
  spiritualRootCountOptions,
  disabled,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [targetCount, setTargetCount] = useState(aptitude.spiritualRootElements.length);
  const [elements, setElements] = useState<FiveElement[]>([...aptitude.spiritualRootElements]);

  useEffect(() => {
    setTargetCount(aptitude.spiritualRootElements.length);
    setElements([...aptitude.spiritualRootElements]);
  }, [aptitude.spiritualRoot, aptitude.spiritualRootElements]);

  const previewLabel = useMemo(() => formatSpiritualRootLabel(elements), [elements]);
  const isValid = elements.length === targetCount && elements.length >= 1;

  const persistElements = (next: FiveElement[]) => {
    if (next.length !== targetCount) return;
    setElements(next);
    startTransition(async () => {
      await updateSpiritualRoot(next);
      router.refresh();
    });
  };

  const toggleElement = (el: FiveElement) => {
    if (disabled || pending) return;
    const has = elements.includes(el);
    if (has) {
      persistElements(elements.filter((e) => e !== el));
      return;
    }
    if (elements.length >= targetCount) return;
    persistElements([...elements, el]);
  };

  const changeTargetCount = (count: number) => {
    setTargetCount(count);
    if (elements.length > count) {
      const trimmed = elements.slice(0, count);
      setElements(trimmed);
      startTransition(async () => {
        await updateSpiritualRoot(trimmed);
        router.refresh();
      });
    }
  };

  return (
    <div className="col-span-2 rounded-lg border border-[#d7c7aa]/80 bg-[rgba(255,250,240,0.55)] p-3">
      <h3 className="mb-1 text-sm font-bold">灵根品相（五行）</h3>
      <p className="mb-3 text-xs text-[#6f6559]">
        参考凡人修仙传：灵根越少越纯，前期修炼越快。四、五灵根为伪灵根，效率偏低。先选数量，再勾选对应五行。
      </p>
      <p className="mb-2 text-xs font-bold text-[#15584c]">{previewLabel}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {spiritualRootCountOptions.map((count) => (
          <button
            key={count}
            type="button"
            disabled={disabled || pending}
            onClick={() => changeTargetCount(count)}
            className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
              targetCount === count
                ? "border-[#b7832d] bg-[#b7832d]/15 text-[#6b4a12]"
                : "border-[#d7c7aa] bg-[#fffdf7] text-[#6f6559]"
            }`}
          >
            {count} 灵根
          </button>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        {fiveElements.map((el) => {
          const selected = elements.includes(el);
          const full = !selected && elements.length >= targetCount;
          return (
            <button
              key={el}
              type="button"
              disabled={disabled || pending || full}
              onClick={() => toggleElement(el)}
              className={`min-w-[3rem] rounded-md border px-3 py-1.5 text-sm font-bold ${
                selected
                  ? "border-[#1f7a69] bg-[#1f7a69]/12 text-[#15584c]"
                  : "border-[#d7c7aa] bg-[#fffdf7] text-[#6f6559] disabled:opacity-40"
              }`}
            >
              {el}
            </button>
          );
        })}
      </div>
      {!isValid ? (
        <p className="text-xs text-[#a94435]">
          请再选择 {Math.max(0, targetCount - elements.length)} 个五行元素（已选 {elements.length} / {targetCount}）。
        </p>
      ) : null}
    </div>
  );
}
