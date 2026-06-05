"use server";

import { revalidateBalancePages } from "@/lib/revalidate-paths";
import { prisma } from "@/lib/db";

export async function listManualActivation() {
  const rows = await prisma.manual.findMany({
    orderBy: { externalId: "asc" },
    select: {
      id: true,
      externalId: true,
      name: true,
      type: true,
      rank: true,
      enabled: true,
      proficiency: true,
    },
  });
  return rows;
}

export async function setManualProficiency(id: number, proficiency: string) {
  await prisma.manual.update({ where: { id }, data: { proficiency } });
  revalidateBalancePages();
}

export async function setManualEnabled(id: number, enabled: boolean) {
  await prisma.manual.update({ where: { id }, data: { enabled } });
  revalidateBalancePages();
}

export async function setManualsEnabled(ids: number[], enabled: boolean) {
  if (ids.length === 0) return;
  await prisma.manual.updateMany({
    where: { id: { in: ids } },
    data: { enabled },
  });
  revalidateBalancePages();
}
