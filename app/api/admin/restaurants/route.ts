import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" }
  });
  return NextResponse.json({
    restaurants: restaurants.map((r) => ({ id: r.id, name: r.name, slug: r.slug, qrImageUrl: r.qrImageUrl }))
  });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as { slug?: string; qrImageUrl?: string; qrPassword?: string } | null;

  const slug = body?.slug?.trim();
  const qrImageUrl = body?.qrImageUrl?.trim();
  const qrPassword = body?.qrPassword?.trim() ?? "";

  if (!slug || !qrImageUrl) {
    return NextResponse.json({ error: "slug and qrImageUrl are required" }, { status: 400 });
  }

  const expectedPassword = process.env.ADMIN_QR_PASS ?? process.env.ADMIN_PASS ?? "";
  if (expectedPassword && qrPassword !== expectedPassword) {
    return NextResponse.json({ error: "Invalid QR password" }, { status: 403 });
  }

  const updated = await prisma.restaurant.update({
    where: { slug },
    data: { qrImageUrl }
  });

  return NextResponse.json({
    ok: true,
    restaurant: { id: updated.id, slug: updated.slug, qrImageUrl: updated.qrImageUrl }
  });
}
