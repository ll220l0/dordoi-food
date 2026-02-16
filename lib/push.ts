import webpush from "web-push";
import { prisma } from "@/lib/prisma";

type PushOrderStatus = "pending_confirmation" | "confirmed" | "delivered" | "canceled";

type PushPayload = {
  title: string;
  body: string;
  url: string;
  orderId: string;
  status: string;
};

let vapidConfigured = false;

function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
}

function getVapidPrivateKey() {
  return process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
}

function getVapidSubject() {
  return process.env.VAPID_SUBJECT?.trim() ?? "";
}

function ensureVapidConfigured() {
  if (vapidConfigured) return true;

  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  const subject = getVapidSubject();

  if (!publicKey || !privateKey || !subject) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

function getStatusPayload(orderId: string, status: PushOrderStatus): PushPayload {
  const base = {
    url: `/order/${orderId}`,
    orderId,
    status
  };

  if (status === "confirmed") {
    return {
      ...base,
      title: "Dordoi Food",
      body: "Order confirmed by restaurant."
    };
  }

  if (status === "delivered") {
    return {
      ...base,
      title: "Dordoi Food",
      body: "Order marked as delivered."
    };
  }

  if (status === "pending_confirmation") {
    return {
      ...base,
      title: "Dordoi Food",
      body: "Payment received. Waiting for restaurant confirmation."
    };
  }

  return {
    ...base,
    title: "Dordoi Food",
    body: "Order canceled."
  };
}

export function isPushConfigured() {
  return Boolean(getVapidPublicKey() && getVapidPrivateKey() && getVapidSubject());
}

export async function savePushSubscription(input: {
  orderId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime?: number | null;
}) {
  const expirationTime =
    typeof input.expirationTime === "number" && Number.isFinite(input.expirationTime)
      ? new Date(input.expirationTime)
      : null;

  await prisma.pushSubscription.upsert({
    where: {
      orderId_endpoint: {
        orderId: input.orderId,
        endpoint: input.endpoint
      }
    },
    create: {
      orderId: input.orderId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      expirationTime
    },
    update: {
      p256dh: input.p256dh,
      auth: input.auth,
      expirationTime
    }
  });
}

export async function removePushSubscription(input: { orderId?: string; endpoint: string }) {
  if (input.orderId) {
    await prisma.pushSubscription.deleteMany({
      where: {
        orderId: input.orderId,
        endpoint: input.endpoint
      }
    });
    return;
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: input.endpoint }
  });
}

export async function sendOrderStatusPush(orderId: string, status: PushOrderStatus) {
  if (!ensureVapidConfigured()) {
    return { sent: 0, removed: 0, skipped: true as const };
  }

  const subs = await prisma.pushSubscription.findMany({
    where: { orderId },
    select: { endpoint: true, p256dh: true, auth: true }
  });

  if (subs.length === 0) {
    return { sent: 0, removed: 0, skipped: false as const };
  }

  const payload = JSON.stringify(getStatusPayload(orderId, status));
  const staleEndpoints = new Set<string>();
  let sent = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        },
        payload
      );
      sent += 1;
    } catch (error: unknown) {
      const statusCode =
        typeof error === "object" && error !== null && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) {
        staleEndpoints.add(sub.endpoint);
      }
    }
  }

  if (staleEndpoints.size > 0) {
    await prisma.pushSubscription.deleteMany({
      where: {
        orderId,
        endpoint: { in: [...staleEndpoints] }
      }
    });
  }

  return { sent, removed: staleEndpoints.size, skipped: false as const };
}
