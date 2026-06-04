import { listRealms } from "@/actions/balance";
import { loadBalanceState } from "@/actions/state";
import { RealmTableEditor } from "./realm-table-editor";

export async function RealmTableSection() {
  const [realms, state] = await Promise.all([listRealms(), loadBalanceState()]);
  return <RealmTableEditor initialRealms={realms} initialHeroRealm={state.heroRealm} />;
}
