import { NextResponse } from "next/server";
import { toApiError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      include: { restaurant: true, items: true },
      orderBy: { createdAt: "desc" },
      take: 200
    });

    return NextResponse.json({
      orders: orders.map((o) => ({
        id: o.id,
        status: o.status,
        totalKgs: o.totalKgs,
        paymentMethod: o.paymentMethod,
        payerName: o.payerName ?? "",
        paymentCode: o.paymentCode,
        customerPhone: o.customerPhone ?? "",
        comment: o.comment ?? "",
        restaurant: { name: o.restaurant.name, slug: o.restaurant.slug },
        location: o.location,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        items: o.items.map((x) => ({
          id: x.id,
          title: x.titleSnap,
          qty: x.qty,
          priceKgs: x.priceKgs,
          photoUrl: x.photoSnap
        })),
        itemCount: o.items.reduce((s, x) => s + x.qty, 0)
      }))
    });
  } catch (error: unknown) {
    const apiError = toApiError(error, "Failed to load orders");
    return NextResponse.json({ error: apiError.message }, { status: apiError.status });
  }
}
