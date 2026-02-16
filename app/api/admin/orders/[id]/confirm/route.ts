import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusPush } from "@/lib/push";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const updated = await prisma.order.update({ where: { id }, data: { status: "confirmed" } });
  try {
    await sendOrderStatusPush(id, "confirmed");
  } catch (error) {
    console.error("Failed to send push for confirmed", { id, error });
  }
  return NextResponse.json({ ok: true, status: updated.status });
}
