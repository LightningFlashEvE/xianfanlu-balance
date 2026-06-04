import { revalidatePath } from "next/cache";

export function revalidateBalancePages() {
  revalidatePath("/");
  revalidatePath("/sandbox");
  revalidatePath("/manage");
}
