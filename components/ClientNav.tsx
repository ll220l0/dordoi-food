"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/lib/cartStore";
import { getActiveOrderId, getLastOrderId, getPendingPayOrderId } from "@/lib/clientPrefs";
import { isHistoryStatus } from "@/lib/orderStatus";

type Props = {
  menuHref: string;
  orderHref?: string | null;
};

function extractOrderId(href: string) {
  const match = href.match(/^\/(?:order|pay)\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function getOrderDotClassName(status: string | null) {
  switch (status) {
    case "confirmed":
      return "bg-emerald-500";
    case "cooking":
      return "bg-indigo-500";
    case "delivering":
      return "bg-sky-500";
    case "canceled":
      return "bg-rose-500";
    case "delivered":
      return "bg-green-500";
    case "created":
    case "pending_confirmation":
    default:
      return "bg-amber-500";
  }
}

export function ClientNav({ menuHref, orderHref }: Props) {
  const pathname = usePathname();
  const lines = useCart((state) => state.lines);
  const cartCount = useMemo(() => lines.reduce((sum, line) => sum + line.qty, 0), [lines]);
  const [fallbackOrderHref, setFallbackOrderHref] = useState("/order");
  const [activeOrderStatus, setActiveOrderStatus] = useState<string | null>(null);

  const resolvedOrderHref = orderHref ?? fallbackOrderHref;

  useEffect(() => {
    if (orderHref) return;

    const syncOrderHref = () => {
      const pendingPayOrderId = getPendingPayOrderId();
      const activeOrderId = getActiveOrderId();
      const lastOrderId = getLastOrderId();
      setFallbackOrderHref(
        pendingPayOrderId ? `/pay/${pendingPayOrderId}` : activeOrderId ? `/order/${activeOrderId}` : lastOrderId ? `/order/${lastOrderId}` : "/order"
      );
    };

    syncOrderHref();
    const timer = window.setInterval(syncOrderHref, 1500);
    const onFocus = () => syncOrderHref();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncOrderHref();
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key === "dordoi_pending_pay_order_id" || event.key === "dordoi_active_order_id") {
        syncOrderHref();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("storage", onStorage);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [orderHref]);

  useEffect(() => {
    let stopped = false;

    const orderIdFromPath = extractOrderId(pathname);
    const orderId = orderIdFromPath ?? extractOrderId(resolvedOrderHref);

    if (!orderId) {
      setActiveOrderStatus(null);
      return;
    }

    const loadOrderStatus = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { status?: string };
        if (!stopped) setActiveOrderStatus(j.status ?? null);
      } catch {
        // transient network error ignored
      }
    };

    void loadOrderStatus();
    const timer = window.setInterval(() => void loadOrderStatus(), 5000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [pathname, resolvedOrderHref]);

  const hasActiveOrder = activeOrderStatus ? !isHistoryStatus(activeOrderStatus) : false;
  const orderDotClassName = getOrderDotClassName(activeOrderStatus);

  const itemClassName = (active: boolean) =>
    clsx(
      "relative inline-flex min-w-[6.4rem] items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300",
      active
        ? "bg-black text-white shadow-[0_12px_24px_rgba(15,23,42,0.3)]"
        : "border border-white/85 bg-white/70 text-slate-600 hover:bg-white/90"
    );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-2">
      <div className="mx-auto flex w-full max-w-md flex-wrap items-center justify-center gap-2 rounded-[28px] border border-white/85 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(248,250,252,0.72))] p-2 shadow-[0_18px_42px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
        <Link href={menuHref} className={itemClassName(pathname.startsWith("/r/"))}>
          Меню
        </Link>

        <Link href="/cart" className={itemClassName(pathname === "/cart")}>
          Корзина
          {cartCount > 0 && (
            <span aria-hidden="true" className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-orange-500 shadow-[0_0_0_3px_rgba(255,255,255,0.9)]" />
          )}
        </Link>

        <Link
          href={resolvedOrderHref}
          className={itemClassName(pathname === "/order" || pathname.startsWith("/order/") || pathname.startsWith("/pay/"))}
        >
          Заказ
          {hasActiveOrder && (
            <span
              aria-hidden="true"
              className={clsx("absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full shadow-[0_0_0_3px_rgba(255,255,255,0.9)]", orderDotClassName)}
            />
          )}
        </Link>
      </div>
    </div>
  );
}
