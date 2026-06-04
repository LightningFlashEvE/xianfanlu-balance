import { listManualActivation } from "@/actions/evaluator";
import { ActiveManualsPanel } from "./active-manuals-panel";

export async function ActiveManualsSection() {
  const manuals = await listManualActivation();
  return <ActiveManualsPanel initial={manuals} />;
}
