"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetBalanceData } from "@/actions/hero";
import { Button } from "@/components/ui/button";

export function EvaluatorToolbar() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            if (!confirm("确定恢复初始设定？将重置境界、装备、功法与主角配置。")) return;
            await resetBalanceData();
            router.refresh();
          })
        }
      >
        {pending ? "处理中…" : "重置"}
      </Button>
    </div>
  );
}
