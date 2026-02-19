"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { Button, Card } from "@/components/ui";
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

function getStatusTone(status: string) {
  if (status === "delivered") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "canceled") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "created" || status === "pending_confirmation") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

export default function AdminOrdersPage() {
  const [data, setData] = useState<AdminOrdersResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

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

  function openCancelModal(id: string) {
    setCancelOrderId(id);
    setCancelReason("");
  }

  function closeCancelModal(force = false) {
    if (cancelLoading && !force) return;
    setCancelOrderId(null);
    setCancelReason("");
  }

  async function submitCancelOrder() {
    if (!cancelOrderId) return;
    const reason = cancelReason.trim();
    if (!reason) {
      toast.error("Причина отмены обязательна");
      return;
    }

    setCancelLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${cancelOrderId}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason })
      });
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(j?.error ?? "Ошибка");
        return;
      }
      toast.success("Заказ отменен");
      closeCancelModal(true);
      await load(true);
    } finally {
      setCancelLoading(false);
    }
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
    const statusTone = getStatusTone(statusForDisplay);
    const whatsappHref = order.customerPhone
      ? buildWhatsAppLink(
          normalizePhone(order.customerPhone),
          `Здравствуйте! По заказу ${order.id}: статус "${statusMeta.label}". Спасибо за выбор Dordoi Food!`
        )
      : null;

    return (
      <Card key={order.id} className="overflow-hidden border border-black/10 bg-white/90 p-0 shadow-[0_14px_35px_rgba(15,23,42,0.12)]">
        <div className="border-b border-black/10 bg-white/85 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-black/45">Заказ #{order.id.slice(-6)}</div>
              <div className="mt-1 text-base font-bold text-black/90">{order.restaurant?.name ?? "-"}</div>
            </div>
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusTone}`}>{statusMeta.label}</span>
          </div>
          <div className="mt-2 text-xs text-black/50">Обновлен: {new Date(order.updatedAt).toLocaleString()}</div>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="rounded-2xl border border-black/10 bg-slate-50/80 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-black/45">Плательщик</div>
                <div className="mt-1 text-base font-bold text-black/90">{order.payerName || "НЕ УКАЗАН"}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-black/45">Сумма</div>
                <div className="mt-1 text-lg font-extrabold text-black/90">{formatKgs(order.totalKgs)}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-2xl border border-black/10 bg-white p-3 text-sm">
            <div className="text-black/55">Метод оплаты</div>
            <div className="text-right font-semibold text-black/85">{paymentMethodLabel(order.paymentMethod)}</div>
            <div className="text-black/55">Телефон</div>
            <div className="text-right font-semibold text-black/85">{order.customerPhone || "-"}</div>
            <div className="text-black/55">Создан</div>
            <div className="text-right text-black/75">{new Date(order.createdAt).toLocaleString()}</div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-3 text-sm text-black/75">
            Проход <b>{order.location?.line || "-"}</b>, контейнер <b>{order.location?.container || "-"}</b>
            {order.location?.landmark ? <> ({order.location.landmark})</> : null}
          </div>

          {order.comment ? <div className="rounded-2xl border border-black/10 bg-white p-3 text-sm text-black/75">Комментарий: {order.comment}</div> : null}
          {order.status === "canceled" && order.canceledReason ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Причина отмены: {order.canceledReason}</div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {(order.status === "created" || order.status === "pending_confirmation") && (
              <Button onClick={() => void confirm(order.id)} className="h-10 px-4">
                Подтвердить оплату
              </Button>
            )}
            {isApprovedStatus(order.status) && order.status !== "delivered" && (
              <Button onClick={() => void deliver(order.id)} variant="secondary" className="h-10 px-4">
                Подтвердить доставку
              </Button>
            )}
            {isApprovedStatus(order.status) && order.status !== "delivered" && (
              <Button onClick={() => openCancelModal(order.id)} variant="secondary" className="h-10 border-rose-300 bg-rose-50 px-4 text-rose-700">
                Отменить заказ
              </Button>
            )}
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                Написать в WhatsApp
              </a>
            )}
          </div>

          <div className="space-y-2 border-t border-black/10 pt-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-black/10 bg-white px-2 py-2">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-black/5 ring-1 ring-black/5">
                  <Image src={item.photoUrl} alt={item.title} fill className="object-cover" sizes="44px" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-black/90">{item.title}</div>
                  <div className="text-xs text-black/55">
                    {item.qty} x {formatKgs(item.priceKgs)}
                  </div>
                </div>
                <div className="text-sm font-bold text-black/90">{formatKgs(item.priceKgs * item.qty)}</div>
              </div>
            ))}
          </div>
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

      {cancelOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            aria-label="Закрыть окно причины отмены"
            onClick={() => closeCancelModal()}
          />
          <Card className="relative z-10 w-full max-w-md p-4">
            <div className="text-lg font-extrabold">Причина отмены</div>
            <div className="mt-1 text-sm text-black/60">Укажите причину, она будет видна в истории заказа.</div>
            <textarea
              className="mt-3 h-28 w-full resize-none rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/25"
              placeholder="Например: клиент попросил отмену"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              disabled={cancelLoading}
            />
            <div className="mt-3 flex gap-2">
              <Button className="flex-1" variant="secondary" onClick={() => closeCancelModal()} disabled={cancelLoading}>
                Отмена
              </Button>
              <Button className="flex-1" onClick={() => void submitCancelOrder()} disabled={cancelLoading}>
                {cancelLoading ? "Сохраняем..." : "Подтвердить"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
