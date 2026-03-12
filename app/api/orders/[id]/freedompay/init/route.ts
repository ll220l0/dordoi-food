import { NextResponse } from "next/server";
import { toApiError } from "@/lib/apiError";
import {
  buildFreedomPayConfig,
  formatFreedomPayAmount,
  makeFreedomPaySalt,
  parseFreedomPayPayload,
  resolvePublicOrigin,
  signFreedomPayParams
} from "@/lib/freedomPay";
import { expireStaleOrders } from "@/lib/orderLifecycle";
import { prisma } from "@/lib/prisma";

type InitBody = {
  payerName?: string;
};

function formatDescription(orderId: string) {
  return `Оплата заказа #${orderId.slice(-6)}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await expireStaleOrders();

    const config = buildFreedomPayConfig();
    if (!config.enabled) {
      return NextResponse.json({ error: "Freedom Pay не настроен" }, { status: 400 });
    }

    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { restaurant: true }
    });

    if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    if (order.paymentMethod === "cash") return NextResponse.json({ error: "Это не банковский заказ" }, { status: 400 });
    if (order.status === "canceled" || order.status === "delivered") {
      return NextResponse.json({ error: "Для этого заказа оплата недоступна" }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as InitBody | null;
    const payerName = body?.payerName?.trim() ?? "";

    if (payerName && payerName !== order.payerName) {
      await prisma.order.update({
        where: { id },
        data: {
          payerName: payerName.slice(0, 60)
        }
      });
    }

    const origin = resolvePublicOrigin(req);
    const salt = makeFreedomPaySalt();

    const requestParams: Record<string, string> = {
      pg_merchant_id: config.merchantId,
      pg_order_id: order.id,
      pg_amount: formatFreedomPayAmount(order.totalKgs),
      pg_currency: config.currency,
      pg_description: formatDescription(order.id),
      pg_salt: salt,
      pg_result_url: `${origin}/api/payments/freedompay/result`,
      pg_success_url: `${origin}/pay/${order.id}`,
      pg_failure_url: `${origin}/pay/${order.id}`,
      pg_request_method: "POST"
    };

    if (config.testMode) {
      requestParams.pg_testing_mode = "1";
    }

    if (order.customerPhone?.trim()) {
      requestParams.pg_user_phone = order.customerPhone.trim();
    }

    const pgSig = signFreedomPayParams("init_payment.php", requestParams, config.secretKey);
    const formData = new URLSearchParams({ ...requestParams, pg_sig: pgSig });

    const providerRes = await fetch(`${config.apiBase}/init_payment.php`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
      cache: "no-store"
    });

    const raw = await providerRes.text();
    const payload = parseFreedomPayPayload(raw, providerRes.headers.get("content-type"));

    if (!providerRes.ok) {
      const providerError = payload.pg_error_description || payload.pg_description || "Freedom Pay временно недоступен";
      throw new Error(providerError);
    }

    if (payload.pg_status !== "ok" || !payload.pg_redirect_url) {
      const providerError = payload.pg_error_description || payload.pg_description || "Не удалось открыть оплату Freedom Pay";
      throw new Error(providerError);
    }

    return NextResponse.json({
      ok: true,
      redirectUrl: payload.pg_redirect_url
    });
  } catch (error: unknown) {
    const apiError = toApiError(error, "Не удалось инициализировать платеж Freedom Pay");
    return NextResponse.json({ error: apiError.message }, { status: apiError.status });
  }
}