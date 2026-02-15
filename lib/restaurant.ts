import { prisma } from "@/lib/prisma";

const DEFAULT_SLUG = "dordoi-food";
const DEFAULT_QR_IMAGE = "/qr/demo-restaurant.png";

export async function ensureActiveRestaurant() {
  const active = await prisma.restaurant.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" }
  });
  if (active) return active;

  const firstExisting = await prisma.restaurant.findFirst({
    orderBy: { createdAt: "asc" }
  });
  if (firstExisting) {
    return prisma.restaurant.update({
      where: { id: firstExisting.id },
      data: { isActive: true }
    });
  }

  const appName = (process.env.NEXT_PUBLIC_APP_NAME || "Dordoi Food").trim();
  return prisma.restaurant.create({
    data: {
      slug: DEFAULT_SLUG,
      name: appName || "Dordoi Food",
      qrImageUrl: DEFAULT_QR_IMAGE,
      isActive: true
    }
  });
}
