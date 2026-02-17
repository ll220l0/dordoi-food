import { NextResponse } from "next/server";
import { toApiError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusPush } from "@/lib/push";

type MarkPaidBody = {
  payerName?: string;
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as MarkPaidBody | null;
    const payerName = body?.payerName?.trim() ?? "";

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (order.paymentMethod === "cash") return NextResponse.json({ error: "Not bank order" }, { status: 400 });

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: "pending_confirmation",
        ...(payerName ? { payerName: payerName.slice(0, 60) } : {})
      }
    });
    try {
      await sendOrderStatusPush(id, "pending_confirmation");
    } catch (error) {
      console.error("Failed to send push for pending_confirmation", { id, error });
    }
    return NextResponse.json({ ok: true, status: updated.status });
  } catch (error: unknown) {
    const apiError = toApiError(error, "Failed to update payment status");
    return NextResponse.json({ error: apiError.message }, { status: apiError.status });
  }
}
