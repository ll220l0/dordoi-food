"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { Button, Card, Photo } from "@/components/ui";
import { formatKgs } from "@/lib/money";
import { paymentMethodLabel } from "@/lib/paymentMethod";
import { getOrderStatusMeta, isApprovedStatus, isHistoryStatus } from "@/lib/orderStatus";
import { buildWhatsAppLink } from "@/lib/whatsapp";

type AdminOrderItem = {
  id: string;
  title: string;
  qty: number;
  priceKgs: number;
  photoUrl: string;
};

type AdminOrder = {
  id: string;
  status: string;
  totalKgs: number;
  paymentMethod: string;
  payerName: string;
  canceledReason: string;
  customerPhone: string;
  comment: string;
  itemCount: number;
  restaurant: { name: string; slug?: string };
  location: { line?: string; container?: string; landmark?: string };
  createdAt: string;
  updatedAt: string;
  items: AdminOrderItem[];
};

type AdminOrdersResponse = { orders: AdminOrder[] };

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to fetch orders";
}

function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, "");
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

  async function cancelOrder(id: string) {
    const reasonInput = window.prompt("Укажите причину отмены заказа");
    if (reasonInput === null) return;
    const reason = reasonInput.trim();
    if (!reason) {
      toast.error("Причина отмены обязательна");
      return;
    }

    const res = await fetch(`/api/admin/orders/${id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason })
    });
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) toast.error(j?.error ?? "Ошибка");
    else toast.success("Заказ отменен");
    void load(true);
  }

  const orders = useMemo(() => data?.orders ?? [], [data?.orders]);
  const activeOrders = useMemo(
    () => orders.filter((o) => !isHistoryStatus(o.status) && o.payerName.trim().length > 0),
    [orders]
  );
  const historyOrders = useMemo(() => orders.filter((o) => isHistoryStatus(o.status)), [orders]);

  function renderOrderCard(order: AdminOrder) {
    const statusForDisplay = order.status === "created" ? "pending_confirmation" : order.status;
    const statusMeta = getOrderStatusMeta(statusForDisplay);
    const whatsappHref = order.customerPhone
      ? buildWhatsAppLink(
          normalizePhone(order.customerPhone),
          `Здравствуйте! По заказу ${order.id}: статус "${statusMeta.label}". Спасибо за выбор Dordoi Food!`
        )
      : null;

    return (
      <Card key={order.id} className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-semibold">{order.restaurant?.name ?? "-"}</div>
          <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${statusMeta.badgeClassName}`}>{statusMeta.label}</span>
        </div>

        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Плательщик</div>
          <div className="mt-1 text-lg font-extrabold text-emerald-900">{order.payerName || "НЕ УКАЗАН"}</div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="text-black/60">Сумма</div>
          <div className="text-right font-bold">{formatKgs(order.totalKgs)}</div>
          <div className="text-black/60">Метод оплаты</div>
          <div className="text-right">{paymentMethodLabel(order.paymentMethod)}</div>
          <div className="text-black/60">Телефон</div>
          <div className="text-right">{order.customerPhone || "-"}</div>
          <div className="text-black/60">Создан</div>
          <div className="text-right">{new Date(order.createdAt).toLocaleString()}</div>
          <div className="text-black/60">Обновлен</div>
          <div className="text-right">{new Date(order.updatedAt).toLocaleString()}</div>
        </div>

        <div className="mt-3 text-sm text-black/70">
          Проход <b>{order.location?.line || "-"}</b>, контейнер <b>{order.location?.container || "-"}</b>
          {order.location?.landmark ? <> ({order.location.landmark})</> : null}
        </div>
        {order.comment ? <div className="mt-1 text-sm text-black/70">Комментарий: {order.comment}</div> : null}
        {order.status === "canceled" && order.canceledReason ? (
          <div className="mt-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Причина отмены: {order.canceledReason}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {(order.status === "created" || order.status === "pending_confirmation") && (
            <Button onClick={() => void confirm(order.id)}>Подтвердить оплату</Button>
          )}
          {isApprovedStatus(order.status) && order.status !== "delivered" && (
            <Button onClick={() => void deliver(order.id)} variant="secondary">
              Подтвердить доставку
            </Button>
          )}
          {isApprovedStatus(order.status) && order.status !== "delivered" && (
            <Button onClick={() => void cancelOrder(order.id)} variant="secondary" className="border-rose-300 bg-rose-50 text-rose-700">
              Отменить заказ
            </Button>
          )}
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
            >
              Написать в WhatsApp
            </a>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {order.items.map((item) => (
            <Card key={item.id} className="p-3">
              <div className="flex gap-3">
                <Photo src={item.photoUrl} alt={item.title} />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold">{item.title}</div>
                    <div className="font-bold">{formatKgs(item.priceKgs * item.qty)}</div>
                  </div>
                  <div className="mt-1 text-sm text-black/55">
                    {item.qty} x {formatKgs(item.priceKgs)}
                  </div>
                </div>
              </div>
            </Card>
          ))}
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
