import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildBalanceExport,
  migrateLegacyBalanceRealm,
  migrateLegacyItemQuality,
  migrateLegacyMaxRealm,
  normalizeEquipmentCategory,
  normalizeEquipmentSlot,
  normalizeStringList,
} from "@xianfanlu/core";
import { prisma } from "@xianfanlu/database";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../out");

async function main() {
  const [realms, equipment, manuals] = await Promise.all([
    prisma.realm.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.equipment.findMany({ orderBy: { externalId: "asc" } }),
    prisma.manual.findMany({ orderBy: { externalId: "asc" } }),
  ]);

  const payload = buildBalanceExport({
    realms: realms.map((r) => ({ name: r.name, multiplier: r.multiplier })),
    equipment: equipment.map((e) => {
      const slot = normalizeEquipmentSlot(e.slot);
      return {
        id: e.externalId,
        baseId: e.baseId?.trim() || e.externalId,
        name: e.name,
        slot,
        category: normalizeEquipmentCategory(slot, e.category),
        quality: migrateLegacyItemQuality(e.quality),
        balanceRealm: migrateLegacyBalanceRealm(e.balanceRealm),
        dropTags: normalizeStringList(e.dropTags),
        forgeTags: normalizeStringList(e.forgeTags),
        upgradeTier: e.upgradeTier ?? 0,
        affixSlots: e.affixSlots ?? 0,
        affixTags: normalizeStringList(e.affixTags),
        combat: (e.combat as Record<string, number>) ?? {},
        growth: (e.growth as Record<string, number>) ?? {},
        note: e.note,
      };
    }),
    manuals: manuals.map((m) => ({
      id: m.externalId,
      name: m.name,
      type: m.type,
      rank: m.rank,
      maxRealm: migrateLegacyMaxRealm(m.maxRealm),
      combat: (m.combat as Record<string, number>) ?? {},
      growth: (m.growth as Record<string, number>) ?? {},
      note: m.note,
    })),
  });

  await mkdir(outDir, { recursive: true });
  const filePath = path.join(outDir, "balance_v2.json");
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Exported to ${filePath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
