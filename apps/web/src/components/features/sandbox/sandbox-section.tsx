import { getSandboxData } from "@/actions/sandbox";
import { loadBalanceState } from "@/actions/state";
import { SandboxPanel } from "./sandbox-panel";

export async function SandboxSection() {
  const [sandbox, state] = await Promise.all([getSandboxData(), loadBalanceState()]);
  return <SandboxPanel initial={sandbox} equipmentInstances={state.equipment} />;
}
