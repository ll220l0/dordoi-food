import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizeReason(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 300);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as { reason?: unknown } | null;
  const reason = normalizeReason(payload?.reason);

  if (!reason) {
    return NextResponse.json({ error: "Cancel reason is required" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canCancel = order.status === "confirmed" || order.status === "cooking" || order.status === "delivering";
  if (!canCancel) {
    return NextResponse.json({ error: "Only confirmed active orders can be canceled" }, { status: 400 });
  }

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status: "canceled",
      canceledReason: reason
    }
  });

  return NextResponse.json({ ok: true, status: updated.status, canceledReason: updated.canceledReason });
}
