import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpsertCategorySchema } from "@/lib/validators";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = UpsertCategorySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Некорректные данные запроса", details: parsed.error.flatten() }, { status: 400 });

  const { restaurantSlug, title, sortOrder } = parsed.data;
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: restaurantSlug } });
  if (!restaurant) return NextResponse.json({ error: "Ресторан не найден" }, { status: 404 });

  const cat = await prisma.category.create({ data: { restaurantId: restaurant.id, title, sortOrder } });
  return NextResponse.json({ ok: true, category: cat });
}
