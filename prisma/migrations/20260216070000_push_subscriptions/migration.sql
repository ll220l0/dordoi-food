CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "expirationTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_orderId_endpoint_key" ON "PushSubscription"("orderId", "endpoint");
CREATE INDEX "PushSubscription_orderId_idx" ON "PushSubscription"("orderId");
CREATE INDEX "PushSubscription_endpoint_idx" ON "PushSubscription"("endpoint");

ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
