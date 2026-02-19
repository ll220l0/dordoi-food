import { NextResponse } from "next/server";
import { removePushSubscription } from "@/lib/push";

type UnsubscribeBody = {
  orderId?: string;
  endpoint?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as UnsubscribeBody | null;
  const orderId = body?.orderId?.trim() || undefined;
  const endpoint = body?.endpoint?.trim() ?? "";

  if (!endpoint) {
    return NextResponse.json({ error: "Требуется адрес подписки" }, { status: 400 });
  }

  await removePushSubscription({ orderId, endpoint });
  return NextResponse.json({ ok: true });
}
