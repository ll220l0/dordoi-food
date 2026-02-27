import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/auditLog";
import { prisma } from "@/lib/prisma";

type WebhookPayload = {
  orderId?: string;
  paymentCode?: string;
  status?: string;
  amountKgs?: number;
  payerName?: string;
  txId?: string;
};

function isSuccessStatus(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "success" || normalized === "paid" || normalized === "confirmed" || normalized === "ok";
}

export async function POST(req: Request) {
  const expected = process.env.MBANK_WEBHOOK_SECRET?.trim() ?? "";
  const provided = req.headers.get("x-webhook-secret")?.trim() ?? "";

  if (expected && provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as WebhookPayload | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const status = (payload.status ?? "").trim();
  const paymentCode = (payload.paymentCode ?? "").trim();
  const orderId = (payload.orderId ?? "").trim();

  if (!paymentCode && !orderId) {
    return NextResponse.json({ error: "paymentCode or orderId is required" }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: orderId ? { id: orderId } : { paymentCode },
    include: { restaurant: true }
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const webhookStatus = status || "unknown";

  if (!isSuccessStatus(webhookStatus)) {
    await prisma.order.update({
      where: { id: order.id },
      data: { bankWebhookStatus: webhookStatus }
    });

    await logAdminAction({
      orderId: order.id,
      action: "payment_webhook_rejected",
      actor: "system:mbank-webhook",
      actorRole: "system",
      meta: { status: webhookStatus, txId: payload.txId ?? null }
    });

    return NextResponse.json({ ok: true, accepted: false, status: webhookStatus });
  }

  const canConfirm = order.status === "created" || order.status === "pending_confirmation";
  if (canConfirm) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "confirmed",
        paymentConfirmedAt: order.paymentConfirmedAt ?? new Date(),
        bankWebhookStatus: webhookStatus,
        bankWebhookConfirmedAt: new Date(),
        payerName: payload.payerName?.trim() ? payload.payerName.trim().slice(0, 60) : order.payerName
      }
    });

    await logAdminAction({
      orderId: order.id,
      action: "payment_confirmed_webhook",
      actor: "system:mbank-webhook",
      actorRole: "system",
      meta: { status: webhookStatus, txId: payload.txId ?? null, amountKgs: payload.amountKgs ?? null }
    });

    return NextResponse.json({ ok: true, confirmed: true, orderId: order.id });
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      bankWebhookStatus: webhookStatus,
      bankWebhookConfirmedAt: order.bankWebhookConfirmedAt ?? new Date()
    }
  });

  await logAdminAction({
    orderId: order.id,
    action: "payment_webhook_received",
    actor: "system:mbank-webhook",
    actorRole: "system",
    meta: { status: webhookStatus, txId: payload.txId ?? null }
  });

  return NextResponse.json({ ok: true, confirmed: false, orderId: order.id, status: order.status });
}
