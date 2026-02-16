import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusPush } from "@/lib/push";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (order.status === "delivered") {
    return NextResponse.json({ error: "Delivered order cannot be canceled" }, { status: 400 });
  }

  try {
    await sendOrderStatusPush(id, "canceled");
  } catch (error) {
    console.error("Failed to send push for canceled", { id, error });
  }
  await prisma.order.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
