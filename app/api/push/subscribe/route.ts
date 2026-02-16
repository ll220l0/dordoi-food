import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPushConfigured, savePushSubscription } from "@/lib/push";

type SubscribeBody = {
  orderId?: string;
  subscription?: {
    endpoint?: string;
    expirationTime?: number | null;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as SubscribeBody | null;

  const orderId = body?.orderId?.trim() ?? "";
  const endpoint = body?.subscription?.endpoint?.trim() ?? "";
  const p256dh = body?.subscription?.keys?.p256dh?.trim() ?? "";
  const auth = body?.subscription?.keys?.auth?.trim() ?? "";
  const expirationTime = body?.subscription?.expirationTime ?? null;

  if (!orderId || !endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true }
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  await savePushSubscription({ orderId, endpoint, p256dh, auth, expirationTime });
  return NextResponse.json({ ok: true, pushConfigured: isPushConfigured() });
}
