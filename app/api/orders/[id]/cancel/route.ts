import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });

  if (order.status === "delivered") {
    return NextResponse.json({ error: "Доставленный заказ нельзя отменить" }, { status: 400 });
  }

  await prisma.order.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
