import { NextResponse } from "next/server";
import { toApiError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { restaurant: true, items: true }
    });

    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: order.id,
      status: order.status,
      totalKgs: order.totalKgs,
      payerName: order.payerName ?? "",
      paymentCode: order.paymentCode,
      paymentMethod: order.paymentMethod,
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
    });
  } catch (error: unknown) {
    const apiError = toApiError(error, "Failed to load order");
    return NextResponse.json({ error: apiError.message }, { status: apiError.status });
  }
}
