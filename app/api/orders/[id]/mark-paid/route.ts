import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusPush } from "@/lib/push";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.paymentMethod !== "qr_image") return NextResponse.json({ error: "Not QR order" }, { status: 400 });

  const updated = await prisma.order.update({ where: { id }, data: { status: "pending_confirmation" } });
  try {
    await sendOrderStatusPush(id, "pending_confirmation");
  } catch (error) {
    console.error("Failed to send push for pending_confirmation", { id, error });
  }
  return NextResponse.json({ ok: true, status: updated.status });
}
