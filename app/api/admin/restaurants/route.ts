import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureActiveRestaurant } from "@/lib/restaurant";

export async function GET() {
  await ensureActiveRestaurant();
  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" }
  });
  return NextResponse.json({
    restaurants: restaurants.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      qrImageUrl: r.qrImageUrl,
      mbankNumber: r.mbankNumber ?? "",
      obankNumber: r.obankNumber ?? "",
      bakaiNumber: r.bakaiNumber ?? ""
    }))
  });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    slug?: string;
    qrImageUrl?: string;
    qrPassword?: string;
    mbankNumber?: string | null;
    obankNumber?: string | null;
    bakaiNumber?: string | null;
    bankPassword?: string;
  } | null;

  const slug = body?.slug?.trim();
  const qrImageUrl = body?.qrImageUrl?.trim() ?? "";
  const qrPassword = body?.qrPassword?.trim() ?? "";
  const bankPassword = body?.bankPassword?.trim() ?? "";

  const hasQrUpdate = Object.prototype.hasOwnProperty.call(body ?? {}, "qrImageUrl");
  const hasMbankUpdate = Object.prototype.hasOwnProperty.call(body ?? {}, "mbankNumber");
  const hasObankUpdate = Object.prototype.hasOwnProperty.call(body ?? {}, "obankNumber");
  const hasBakaiUpdate = Object.prototype.hasOwnProperty.call(body ?? {}, "bakaiNumber");
  const hasBankNumbersUpdate = hasMbankUpdate || hasObankUpdate || hasBakaiUpdate;

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  if (!hasQrUpdate && !hasBankNumbersUpdate) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  if (hasQrUpdate && !qrImageUrl) {
    return NextResponse.json({ error: "qrImageUrl is required" }, { status: 400 });
  }

  if (hasQrUpdate) {
    const expectedQrPassword = process.env.ADMIN_QR_PASS ?? process.env.ADMIN_PASS ?? "";
    if (expectedQrPassword && qrPassword !== expectedQrPassword) {
      return NextResponse.json({ error: "Invalid QR password" }, { status: 403 });
    }
  }

  if (hasBankNumbersUpdate) {
    const expectedBankPassword = process.env.ADMIN_BANK_PASS ?? process.env.ADMIN_PASS ?? "";
    if (expectedBankPassword && bankPassword !== expectedBankPassword) {
      return NextResponse.json({ error: "Invalid bank password" }, { status: 403 });
    }
  }

  const data: Prisma.RestaurantUpdateInput = {};

  if (hasQrUpdate) {
    data.qrImageUrl = qrImageUrl;
  }
  if (hasMbankUpdate) {
    data.mbankNumber = body?.mbankNumber?.trim() || null;
  }
  if (hasObankUpdate) {
    data.obankNumber = body?.obankNumber?.trim() || null;
  }
  if (hasBakaiUpdate) {
    data.bakaiNumber = body?.bakaiNumber?.trim() || null;
  }

  const updated = await prisma.restaurant.update({
    where: { slug },
    data
  });

  return NextResponse.json({
    ok: true,
    restaurant: {
      id: updated.id,
      slug: updated.slug,
      qrImageUrl: updated.qrImageUrl,
      mbankNumber: updated.mbankNumber ?? "",
      obankNumber: updated.obankNumber ?? "",
      bakaiNumber: updated.bakaiNumber ?? ""
    }
  });
}
