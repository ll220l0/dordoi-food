import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateOrderSchema } from "@/lib/validators";
import { makePaymentCode } from "@/lib/paymentCode";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });

  const { restaurantSlug, items, location, paymentMethod, customerPhone, payerName, comment } = parsed.data;

  const restaurant = await prisma.restaurant.findUnique({ where: { slug: restaurantSlug } });
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  const menuItems = await prisma.menuItem.findMany({
    where: { restaurantId: restaurant.id, id: { in: items.map((x) => x.menuItemId) } }
  });
  const map = new Map(menuItems.map((m) => [m.id, m]));
  const orderLines: Array<{ m: (typeof menuItems)[number]; qty: number }> = [];
  for (const x of items) {
    const m = map.get(x.menuItemId);
    if (!m || !m.isAvailable) {
      return NextResponse.json({ error: "Menu item not available" }, { status: 400 });
    }
    orderLines.push({ m, qty: x.qty });
  }

  const totalKgs = orderLines.reduce((s, x) => s + x.m.priceKgs * x.qty, 0);
  const paymentCode = makePaymentCode("BX");

  const order = await prisma.order.create({
    data: {
      restaurantId: restaurant.id,
      status: paymentMethod === "cash" ? "confirmed" : "created",
      paymentMethod,
      totalKgs,
      customerPhone: customerPhone || null,
      payerName: payerName?.trim() || null,
      comment: comment || null,
      paymentCode,
      location,
      items: {
        create: orderLines.map(({ m, qty }) => ({
          menuItemId: m.id,
          qty,
          priceKgs: m.priceKgs,
          titleSnap: m.title,
          photoSnap: m.photoUrl
        }))
      }
    }
  });

  return NextResponse.json({ orderId: order.id });
}
