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

function getOrderDotColor(status: string | null) {
  switch (status) {
    case "confirmed":    return "bg-emerald-500";
    case "cooking":     return "bg-indigo-500";
    case "delivering":  return "bg-sky-500";
    case "canceled":    return "bg-rose-500";
    case "delivered":   return "bg-green-500";
    default:            return "bg-amber-500";
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
        pendingPayOrderId
          ? `/pay/${pendingPayOrderId}`
          : activeOrderId
            ? `/order/${activeOrderId}`
            : lastOrderId
              ? `/order/${lastOrderId}`
              : "/order"
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
  const orderDotColor = getOrderDotColor(activeOrderStatus);

  const isMenu = pathname.startsWith("/r/");
  const isCart = pathname === "/cart";
  const isOrder = pathname === "/order" || pathname.startsWith("/order/") || pathname.startsWith("/pay/");

  const itemClass = (active: boolean) =>
    clsx(
      "relative inline-flex min-w-[5.8rem] items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] select-none",
      active
        ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-[0_10px_24px_rgba(249,115,22,0.36),0_1px_0_rgba(255,255,255,0.22)_inset] border border-orange-400/20"
        : "border border-white/80 bg-white/65 text-slate-600 hover:bg-white/85 hover:shadow-[0_4px_14px_rgba(15,23,42,0.08)]"
    );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2">
      <div className="relative mx-auto flex w-full max-w-md items-center justify-center gap-2 overflow-hidden rounded-[30px] border border-white/90 bg-white/78 p-2 shadow-[0_22px_50px_rgba(15,23,42,0.20),0_1.5px_0_rgba(255,255,255,0.95)_inset,0_0_0_0.5px_rgba(255,255,255,0.55)_inset] backdrop-blur-3xl">
        {/* Specular top highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/75 to-transparent" />

        {/* Menu */}
        <Link href={menuHref} className={itemClass(isMenu)}>
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          Меню
        </Link>

        {/* Cart */}
        <Link href="/cart" className={itemClass(isCart)}>
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
            <path d="M2 3h2l2.4 9h8l1.6-6H5.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="8.5" cy="16" r="1.1" fill="currentColor" />
            <circle cx="13.5" cy="16" r="1.1" fill="currentColor" />
          </svg>
          Корзина
          {cartCount > 0 && (
            <span
              aria-label={`${cartCount} товаров`}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-orange-500 to-amber-400 text-[10px] font-extrabold text-white shadow-[0_3px_8px_rgba(249,115,22,0.4)]"
            >
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
        </Link>

        {/* Order */}
        <Link
          href={resolvedOrderHref}
          className={itemClass(isOrder)}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
            <rect x="3" y="2" width="14" height="16" rx="3" stroke="currentColor" strokeWidth="1.7" />
            <path d="M7 7h6M7 10.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          Заказ
          {hasActiveOrder && (
            <span
              aria-hidden="true"
              className={clsx(
                "absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow-[0_2px_6px_rgba(0,0,0,0.2)]",
                orderDotColor
              )}
            />
          )}
        </Link>
      </div>
    </div>
  );
}
