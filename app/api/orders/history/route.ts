import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const phone = url.searchParams.get("phone")?.trim() ?? "";

  if (phone.length < 7) {
    return NextResponse.json({ error: "phone required" }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: { customerPhone: phone },
    include: { restaurant: true, items: true },
    orderBy: { createdAt: "desc" },
    take: 30
  });

  return NextResponse.json({
    orders: orders.map((order) => ({
      id: order.id,
      status: order.status,
      paymentMethod: order.paymentMethod,
      totalKgs: order.totalKgs,
      paymentCode: order.paymentCode,
      customerPhone: order.customerPhone ?? "",
      comment: order.comment ?? "",
      location: order.location,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      restaurant: {
        name: order.restaurant.name,
        slug: order.restaurant.slug
      },
      items: order.items.map((x) => ({
        id: x.id,
        title: x.titleSnap,
        qty: x.qty,
        priceKgs: x.priceKgs,
        photoUrl: x.photoSnap
      }))
    }))
  });
}
