import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { toApiError } from "@/lib/apiError";
import { buildMbankPayUrl } from "@/lib/mbankLink";
import { makePaymentCode } from "@/lib/paymentCode";
import { toDbPaymentMethod } from "@/lib/paymentMethod";
import { prisma } from "@/lib/prisma";
import { CreateOrderSchema } from "@/lib/validators";

function normalizeIdempotencyKey(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 120);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Некорректные данные запроса", details: parsed.error.flatten() }, { status: 400 });
    }

    const { restaurantSlug, items, location, paymentMethod, customerPhone, payerName, comment } = parsed.data;
    const idempotencyKey = normalizeIdempotencyKey(parsed.data.idempotencyKey || req.headers.get("x-idempotency-key"));

    if (idempotencyKey) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey },
        include: { restaurant: true }
      });

      if (existing) {
        const bankPayUrl =
          existing.paymentMethod === "cash"
            ? null
            : buildMbankPayUrl({ totalKgs: existing.totalKgs, bankPhone: existing.restaurant.mbankNumber });
        return NextResponse.json({ orderId: existing.id, bankPayUrl, created: false });
      }
    }

    const restaurant = await prisma.restaurant.findUnique({ where: { slug: restaurantSlug } });
    if (!restaurant) return NextResponse.json({ error: "Ресторан не найден" }, { status: 404 });

    const menuItems = await prisma.menuItem.findMany({
      where: { restaurantId: restaurant.id, id: { in: items.map((x) => x.menuItemId) } }
    });
    const map = new Map(menuItems.map((m) => [m.id, m]));
    const orderLines: Array<{ m: (typeof menuItems)[number]; qty: number }> = [];
    for (const x of items) {
      const m = map.get(x.menuItemId);
      if (!m || !m.isAvailable) {
        return NextResponse.json({ error: "Позиция меню недоступна" }, { status: 400 });
      }
      orderLines.push({ m, qty: x.qty });
    }

    const totalKgs = orderLines.reduce((s, x) => s + x.m.priceKgs * x.qty, 0);
    const paymentCode = makePaymentCode("BX");
    const dbPaymentMethod = toDbPaymentMethod(paymentMethod);

    let order;
    try {
      order = await prisma.order.create({
        data: {
          restaurantId: restaurant.id,
          status: dbPaymentMethod === "cash" ? "confirmed" : "created",
          paymentMethod: dbPaymentMethod,
          totalKgs,
          customerPhone: customerPhone || null,
          payerName: payerName?.trim() || null,
          comment: comment || null,
          idempotencyKey: idempotencyKey || null,
          paymentConfirmedAt: dbPaymentMethod === "cash" ? new Date() : null,
          paymentCode,
          location,
          items: {
            create: orderLines.map(({ m, qty }) => ({
              menuItemId: m.id,
              qty,
              priceKgs: m.priceKgs,
              titleSnap: m.title,
              photoSnap: m.photoUrl
            }))
          }
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && idempotencyKey) {
        const existing = await prisma.order.findUnique({
          where: { idempotencyKey },
          include: { restaurant: true }
        });

        if (existing) {
          const bankPayUrl =
            existing.paymentMethod === "cash"
              ? null
              : buildMbankPayUrl({ totalKgs: existing.totalKgs, bankPhone: existing.restaurant.mbankNumber });
          return NextResponse.json({ orderId: existing.id, bankPayUrl, created: false });
        }
      }
      throw error;
    }

    const bankPayUrl = dbPaymentMethod === "cash" ? null : buildMbankPayUrl({ totalKgs, bankPhone: restaurant.mbankNumber });
    return NextResponse.json({ orderId: order.id, bankPayUrl, created: true });
  } catch (error: unknown) {
    const apiError = toApiError(error, "Не удалось создать заказ");
    return NextResponse.json({ error: apiError.message }, { status: apiError.status });
  }
}

