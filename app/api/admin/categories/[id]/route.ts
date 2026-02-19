import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const categoryItems = await prisma.menuItem.findMany({
    where: { categoryId: id },
    select: { id: true }
  });

  if (categoryItems.length > 0) {
    const ordersCount = await prisma.orderItem.count({
      where: { menuItemId: { in: categoryItems.map((item) => item.id) } }
    });

    if (ordersCount > 0) {
      return NextResponse.json(
        {
          error:
            "Нельзя удалить категорию: некоторые позиции уже используются в заказах. Удалите такие позиции из категории или сделайте их недоступными."
        },
        { status: 409 }
      );
    }
  }

  try {
    await prisma.menuItem.deleteMany({ where: { categoryId: id } });
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Категория не найдена" }, { status: 404 });
    }

    throw error;
  }
}
