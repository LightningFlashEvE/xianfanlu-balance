export const dynamic = "force-dynamic";

import { SandboxSection } from "@/components/features/sandbox/sandbox-section";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function SandboxPage() {
  return (
    <>
      <Card className="border-[#d7c7aa]/80 bg-[rgba(255,250,240,0.55)]">
        <CardDescription>Combat Sandbox</CardDescription>
        <CardTitle className="mb-1">对战实验</CardTitle>
        <p className="text-sm text-[#6f6559]">
          本页用于手动配装、跨境界对战与功法勾选实验，不参与评估页的标准养成计算。评估页的战力与曲线请查看「评估器」。
        </p>
      </Card>
      <SandboxSection />
    </>
  );
}
