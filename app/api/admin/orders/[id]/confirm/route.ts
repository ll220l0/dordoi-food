import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const updated = await prisma.order.update({ where: { id }, data: { status: "confirmed" } });
  return NextResponse.json({ ok: true, status: updated.status });
}
