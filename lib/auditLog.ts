import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditPayload = {
  orderId?: string | null;
  action: string;
  actor: string;
  actorRole: string;
  meta?: unknown;
};

export async function logAdminAction(payload: AuditPayload) {
  try {
    const data: Prisma.AdminAuditLogCreateInput = {
      order: payload.orderId ? { connect: { id: payload.orderId } } : undefined,
      action: payload.action,
      actor: payload.actor,
      actorRole: payload.actorRole
    };

    if (payload.meta !== undefined) {
      data.meta = payload.meta as Prisma.InputJsonValue;
    }

    await prisma.adminAuditLog.create({ data });
  } catch {
    // Logging must never break core flows.
  }
}

