"use client";

import type { SandboxEnemyPower } from "@/lib/sandbox-combat";
import { SandboxPowerCard } from "./sandbox-power-card";

type Props = {
  power: SandboxEnemyPower;
  pending?: boolean;
};

export function SandboxEnemyPowerCard({ power, pending }: Props) {
  return <SandboxPowerCard variant="enemy" power={power} pending={pending} />;
}
