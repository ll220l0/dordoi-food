import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ordersCount = await prisma.orderItem.count({ where: { menuItemId: id } });
  if (ordersCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete item with order history. Mark it unavailable instead." },
      { status: 409 }
    );
  }

  try {
    await prisma.menuItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return NextResponse.json(
          { error: "Cannot delete item with order history. Mark it unavailable instead." },
          { status: 409 }
        );
      }

      if (error.code === "P2025") {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
    }

    throw error;
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { isAvailable?: boolean } | null;

  if (typeof body?.isAvailable !== "boolean") {
    return NextResponse.json({ error: "isAvailable boolean required" }, { status: 400 });
  }

  const item = await prisma.menuItem.update({
    where: { id },
    data: { isAvailable: body.isAvailable }
  });

  return NextResponse.json({ ok: true, item });
}
