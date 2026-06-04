export const dynamic = "force-dynamic";

import { getManageData } from "@/actions/manage";
import { ManageWorkspace } from "@/components/features/manage/manage-workspace";

export default async function ManagePage() {
  const data = await getManageData();
  return <ManageWorkspace initial={data} />;
}
