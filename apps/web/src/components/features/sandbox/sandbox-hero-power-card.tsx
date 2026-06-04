"use client";

import type { SandboxHeroPower } from "@/lib/sandbox-combat";
import { SandboxPowerCard } from "./sandbox-power-card";

type Props = {
  power: SandboxHeroPower;
  pending?: boolean;
};

export function SandboxHeroPowerCard({ power, pending }: Props) {
  return <SandboxPowerCard variant="hero" power={power} pending={pending} />;
}
