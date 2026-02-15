import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function ensureBaseRestaurant() {
  const activeRestaurant = await prisma.restaurant.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" }
  });

  if (activeRestaurant) {
    console.log(`Active restaurant already exists: ${activeRestaurant.slug}`);
    return activeRestaurant;
  }

  const restaurant = await prisma.restaurant.create({
    data: {
      slug: "dordoi-food",
      name: "Dordoi Food",
      qrImageUrl: "/qr/demo-restaurant.png",
      isActive: true
    }
  });

  console.log(`Created empty restaurant: ${restaurant.slug}`);
  return restaurant;
}

async function main() {
  await ensureBaseRestaurant();
  console.log("Seed completed without creating test menu items");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
