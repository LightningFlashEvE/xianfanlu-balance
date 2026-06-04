import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../src/seed-data.js";

const prisma = new PrismaClient();

async function main() {
  await seedDatabase(prisma);
  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
