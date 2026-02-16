import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusPush } from "@/lib/push";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (order.status === "delivered") {
    return NextResponse.json({ ok: true, status: order.status });
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: "delivered" }
  });

  try {
    await sendOrderStatusPush(id, "delivered");
  } catch (error) {
    console.error("Failed to send push for delivered", { id, error });
  }
  return NextResponse.json({ ok: true, status: updated.status });
}
