import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpsertItemSchema } from "@/lib/validators";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = UpsertItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });

  const { id, restaurantSlug, categoryId, title, description, photoUrl, priceKgs, isAvailable } = parsed.data;

  const restaurant = await prisma.restaurant.findUnique({ where: { slug: restaurantSlug } });
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!cat || cat.restaurantId !== restaurant.id) return NextResponse.json({ error: "Bad category" }, { status: 400 });

  if (id) {
    const updated = await prisma.menuItem.update({
      where: { id },
      data: { categoryId, title, description: description || null, photoUrl, priceKgs, isAvailable }
    });
    return NextResponse.json({ ok: true, item: updated });
  }

  const maxSort = await prisma.menuItem.aggregate({
    where: { categoryId },
    _max: { sortOrder: true }
  });
  const nextSortOrder = (maxSort._max.sortOrder ?? 0) + 1;

  const created = await prisma.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      categoryId,
      title,
      description: description || null,
      photoUrl,
      priceKgs,
      isAvailable,
      sortOrder: nextSortOrder
    }
  });
  return NextResponse.json({ ok: true, item: created });
}
