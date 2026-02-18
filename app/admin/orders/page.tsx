"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { Button, Card } from "@/components/ui";
import { formatKgs } from "@/lib/money";
import { paymentMethodLabel } from "@/lib/paymentMethod";
import { getOrderStatusMeta, isHistoryStatus } from "@/lib/orderStatus";

type AdminOrderItem = {
  id: string;
  title: string;
  qty: number;
  priceKgs: number;
};

type AdminOrder = {
  id: string;
  status: string;
  totalKgs: number;
  paymentMethod: string;
  payerName: string;
  customerPhone: string;
  comment: string;
  itemCount: number;
  restaurant: { name: string };
  location: { line?: string; container?: string; landmark?: string };
  createdAt: string;
  updatedAt: string;
  items: AdminOrderItem[];
};

type AdminOrdersResponse = { orders: AdminOrder[] };

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to fetch orders";
}

export default function AdminOrdersPage() {
  const [data, setData] = useState<AdminOrdersResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `Failed to load orders (${res.status})`);
      }

      const j = (await res.json()) as AdminOrdersResponse;
      setData(j);
      setLoadError(null);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      setLoadError(message);
      if (!silent) toast.error(message);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void load(true);
    }, 1000);
    const onFocus = () => void load(true);
    const onOnline = () => void load(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void load(true);
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [load]);

  async function confirm(id: string) {
    const res = await fetch(`/api/admin/orders/${id}/confirm`, { method: "POST" });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) toast.error(j?.error ?? "Ошибка");
    else toast.success("Оплата подтверждена");
    void load(true);
  }

  async function deliver(id: string) {
    const res = await fetch(`/api/admin/orders/${id}/deliver`, { method: "POST" });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) toast.error(j?.error ?? "Ошибка");
    else toast.success("Заказ доставлен");
    void load(true);
  }

  const orders = useMemo(() => data?.orders ?? [], [data?.orders]);
  const activeOrders = useMemo(() => orders.filter((o) => !isHistoryStatus(o.status)), [orders]);
  const historyOrders = useMemo(() => orders.filter((o) => isHistoryStatus(o.status)), [orders]);

  function renderOrderCard(order: AdminOrder) {
    const statusMeta = getOrderStatusMeta(order.status);

    return (
      <Card key={order.id} className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-bold">Заказ #{order.id.slice(-6)}</div>
            <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Плательщик</span>
              <span className="text-sm font-extrabold text-emerald-900">{order.payerName || "НЕ УКАЗАН"}</span>
            </div>
            <div className="mt-1 text-sm text-black/60">
              Проход <b>{order.location?.line || "-"}</b>, контейнер <b>{order.location?.container || "-"}</b>
              {order.location?.landmark ? <> ({order.location.landmark})</> : null}
            </div>
            <div className="mt-1 text-xs text-black/50">Телефон: {order.customerPhone || "-"}</div>
            <div className="mt-1 text-xs text-black/50">Создан: {new Date(order.createdAt).toLocaleString()}</div>
            <div className="mt-1 text-xs text-black/50">Обновлен: {new Date(order.updatedAt).toLocaleString()}</div>
            {order.comment ? <div className="mt-1 text-xs text-black/50">Комментарий: {order.comment}</div> : null}
          </div>
          <div className="text-right">
            <div className="font-extrabold">{formatKgs(order.totalKgs)}</div>
            <div className="mt-1 text-xs text-black/50">{order.itemCount} шт</div>
            <div className="mt-1 text-xs text-black/50">{paymentMethodLabel(order.paymentMethod)}</div>
            <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusMeta.badgeClassName}`}>
              {statusMeta.label}
            </span>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-black/10 bg-white/70 p-3">
          <div className="text-xs font-semibold text-black/60">Состав заказа</div>
          <div className="mt-1 space-y-1 text-sm">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2">
                <span>{item.title}</span>
                <span className="text-black/60">
                  {item.qty} x {formatKgs(item.priceKgs)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(order.status === "created" || order.status === "pending_confirmation") && (
            <Button onClick={() => void confirm(order.id)} className="px-4 py-2">
              Подтвердить оплату
            </Button>
          )}
          {order.status !== "delivered" && order.status !== "canceled" && (
            <Button onClick={() => void deliver(order.id)} className="px-4 py-2" variant="secondary">
              Подтвердить доставку
            </Button>
          )}
          <Link className="text-sm text-black/60 underline" href={`/admin/orders/${order.id}`} prefetch={false}>
            Подробнее
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <main className="min-h-screen p-5">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-black/50">Admin</div>
            <div className="text-3xl font-extrabold">Заказы</div>
          </div>
          <div className="flex items-center gap-2">
            <Link className="text-sm text-black/60 underline" href="/admin">
              Назад
            </Link>
            <AdminLogoutButton className="px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="mt-6">
          {loadError && (
            <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</div>
          )}
          <div className="mb-3 text-sm font-semibold text-black/65">Активные ({activeOrders.length})</div>
          <div className="space-y-3">{activeOrders.map((order) => renderOrderCard(order))}</div>
        </div>

        <div className="mt-8">
          <div className="mb-3 text-sm font-semibold text-black/65">История ({historyOrders.length})</div>
          <div className="space-y-3">{historyOrders.map((order) => renderOrderCard(order))}</div>
        </div>
      </div>
    </main>
  );
}
