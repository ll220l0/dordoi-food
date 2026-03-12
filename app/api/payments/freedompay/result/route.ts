import { NextResponse } from "next/server";
import {
  buildFreedomPayConfig,
  buildFreedomPayResultXml,
  makeFreedomPaySalt,
  parseFreedomPayPayload,
  scriptNameFromPath,
  signFreedomPayParams,
  verifyFreedomPaySignature
} from "@/lib/freedomPay";
import { prisma } from "@/lib/prisma";

function toXmlResponse(xml: string, status = 200) {
  return new NextResponse(xml, {
    status,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function buildSignedResultXml(scriptName: string, secretKey: string, status: "ok" | "error", description: string) {
  const payload = {
    pg_salt: makeFreedomPaySalt(),
    pg_status: status,
    pg_description: description
  };

  const pgSig = signFreedomPayParams(scriptName, payload, secretKey);
  return buildFreedomPayResultXml({ ...payload, pg_sig: pgSig });
}

function isSuccessfulPayment(payload: Record<string, string>) {
  const pgResult = (payload.pg_result ?? "").trim();
  const paymentStatus = (payload.pg_payment_status ?? "").trim().toLowerCase();

  if (paymentStatus === "success") return true;
  if (pgResult === "1") return true;
  return false;
}

function getWebhookStatus(payload: Record<string, string>) {
  const paymentStatus = (payload.pg_payment_status ?? "").trim().toLowerCase() || "unknown";
  const paymentId = (payload.pg_payment_id ?? "").trim();
  const result = (payload.pg_result ?? "").trim();

  const parts = [paymentStatus, paymentId ? `id:${paymentId}` : "", result ? `result:${result}` : ""].filter(Boolean);
  return parts.join("|").slice(0, 190);
}

async function readPayload(req: Request) {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const fromQuery: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) fromQuery[key] = value;
    return fromQuery;
  }

  const raw = await req.text();
  return parseFreedomPayPayload(raw, req.headers.get("content-type"));
}

async function handleCallback(req: Request) {
  const config = buildFreedomPayConfig();
  if (!config.enabled) {
    return NextResponse.json({ error: "Freedom Pay не настроен" }, { status: 400 });
  }

  const scriptName = scriptNameFromPath(new URL(req.url).pathname);
  const payload = await readPayload(req);

  const signatureScriptName = [scriptName, `${scriptName}.php`].find((candidate) =>
    verifyFreedomPaySignature(candidate, payload, config.secretKey)
  );

  if (!signatureScriptName) {
    const xml = buildSignedResultXml(scriptName, config.secretKey, "error", "Некорректная подпись");
    return toXmlResponse(xml, 200);
  }

  const orderId = (payload.pg_order_id ?? "").trim();
  if (!orderId) {
    const xml = buildSignedResultXml(signatureScriptName, config.secretKey, "error", "Не указан номер заказа");
    return toXmlResponse(xml, 200);
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    const xml = buildSignedResultXml(signatureScriptName, config.secretKey, "error", "Заказ не найден");
    return toXmlResponse(xml, 200);
  }

  const successfulPayment = isSuccessfulPayment(payload);
  const webhookStatus = getWebhookStatus(payload);

  const updateData: {
    bankWebhookStatus: string;
    bankWebhookConfirmedAt?: Date;
    status?: typeof order.status;
    payerName?: string;
  } = {
    bankWebhookStatus: webhookStatus
  };

  if (successfulPayment) {
    updateData.bankWebhookConfirmedAt = new Date();
    if (order.status === "created") updateData.status = "pending_confirmation";
    if (!order.payerName?.trim()) updateData.payerName = "Freedom Pay";
  }

  await prisma.order.update({
    where: { id: orderId },
    data: updateData
  });

  const xml = buildSignedResultXml(signatureScriptName, config.secretKey, "ok", "OK");
  return toXmlResponse(xml, 200);
}

export async function POST(req: Request) {
  return handleCallback(req);
}

export async function GET(req: Request) {
  return handleCallback(req);
}