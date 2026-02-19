import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  if (order.status === "delivered") {
    return NextResponse.json({ ok: true, status: order.status });
  }
  if (order.status !== "confirmed" && order.status !== "cooking" && order.status !== "delivering") {
    return NextResponse.json({ error: "Оплата еще не подтверждена" }, { status: 400 });
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: "delivered" }
  });
  return NextResponse.json({ ok: true, status: updated.status });
}
