import { NextResponse } from "next/server";
import { toApiError } from "@/lib/apiError";
import { toClientPaymentMethod } from "@/lib/paymentMethod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { restaurant: true, items: true }
    });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      id: order.id,
      status: order.status,
      paymentMethod: toClientPaymentMethod(order.paymentMethod),
      totalKgs: order.totalKgs,
      payerName: order.payerName ?? "",
      paymentCode: order.paymentCode,
      location: order.location,
      comment: order.comment ?? "",
      customerPhone: order.customerPhone ?? "",
      restaurant: { name: order.restaurant.name, slug: order.restaurant.slug, qrImageUrl: order.restaurant.qrImageUrl },
      items: order.items.map((x) => ({ id: x.id, title: x.titleSnap, qty: x.qty, priceKgs: x.priceKgs, photoUrl: x.photoSnap })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    });
  } catch (error: unknown) {
    const apiError = toApiError(error, "Failed to load order");
    return NextResponse.json({ error: apiError.message }, { status: apiError.status });
  }
}
