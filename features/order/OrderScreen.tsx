"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button, Card, Photo } from "@/components/ui";
import { ClientNav } from "@/components/ClientNav";
import {
  clearPendingPayOrderId,
  getLastOrderId,
  getOrderHistory,
  getPendingPayOrderId,
  getSavedPhone,
  removeOrderFromHistory,
  setPendingPayOrderId
} from "@/lib/clientPrefs";
import { formatKgs } from "@/lib/money";
import { getOrderStatusMeta, isApprovedStatus, isHistoryStatus, isPendingConfirmation } from "@/lib/orderStatus";

type OrderItem = {
  id: string;
  title: string;
  qty: number;
  priceKgs: number;
  photoUrl: string;
};

type OrderData = {
  id: string;
  status: string;
  paymentMethod: string;
  totalKgs: number;
  paymentCode: string;
  comment?: string;
  customerPhone?: string;
  location?: { line?: string; container?: string; landmark?: string };
  restaurant?: { name?: string; slug?: string };
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

type HistoryOrder = {
  id: string;
  status: string;
  paymentMethod: string;
  totalKgs: number;
  paymentCode: string;
  comment?: string;
  customerPhone?: string;
  location?: { line?: string; container?: string; landmark?: string };
  restaurant?: { name?: string; slug?: string };
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

function notifyUser(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  const show = () => {
    try {
      new Notification(title, { body });
    } catch {
      // Ignore notification errors.
    }
  };

  if (Notification.permission === "granted") {
    show();
    return;
  }

  if (Notification.permission === "default") {
    void Notification.requestPermission().then((permission) => {
      if (permission === "granted") show();
    });
  }
}

function StatusProgress({ status }: { status: string }) {
  if (isPendingConfirmation(status)) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <div className="text-sm font-semibold text-amber-700">Ожидаем подтверждения заказа</div>
      </div>
    );
  }

  if (status === "delivered") {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">✓</div>
        <div className="text-sm font-semibold text-emerald-700">Спасибо за выбор. Заказ доставлен.</div>
      </div>
    );
  }

  if (isApprovedStatus(status)) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">✓</div>
        <div className="text-sm font-semibold text-emerald-700">Заказ подтвержден</div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white">!</div>
      <div className="text-sm font-semibold text-rose-700">Заказ отменен</div>
    </div>
  );
}

export default function OrderScreen({ orderId }: { orderId: string }) {
  const [data, setData] = useState<OrderData | null>(null);
  const [orderMissing, setOrderMissing] = useState(false);
  const [orderLoading, setOrderLoading] = useState(true);
  const [history, setHistory] = useState<HistoryOrder[]>([]);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const loadOrder = useCallback(async (silent = false) => {
    if (!silent) setOrderLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
      if (res.status === 404) {
        setData(null);
        setOrderMissing(true);
        return;
      }
      if (!res.ok) return;

      const j = (await res.json()) as OrderData;
      setData(j);
      setOrderMissing(false);
    } finally {
      if (!silent) setOrderLoading(false);
    }
  }, [orderId]);

  const loadHistory = useCallback(async () => {
    const ids = getOrderHistory().map((entry) => entry.orderId).filter(Boolean);
    const phone = getSavedPhone().trim();

    if (ids.length === 0 && phone.length < 7) {
      setHistory([]);
      return;
    }

    const params = new URLSearchParams();
    if (ids.length > 0) params.set("ids", ids.slice(0, 30).join(","));
    if (phone.length >= 7) params.set("phone", phone);

    const res = await fetch(`/api/orders/history?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) {
      setHistory([]);
      return;
    }

    const j = (await res.json()) as { orders: HistoryOrder[] };
    setHistory((j.orders ?? []).filter((order) => isHistoryStatus(order.status)));
  }, []);

  useEffect(() => {
    setLastOrderId(getLastOrderId());
    const pendingPayOrderId = getPendingPayOrderId();
    if (pendingPayOrderId) {
      setLastOrderId((current) => current ?? pendingPayOrderId);
    }
  }, []);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, data?.status]);

  useEffect(() => {
    if (!data?.id) return;

    const isQrPayment = data.paymentMethod === "qr_image";
    const isPendingPayStatus = data.status === "created" || data.status === "pending_confirmation";

    if (isQrPayment && isPendingPayStatus) {
      setPendingPayOrderId(data.id);
      return;
    }

    clearPendingPayOrderId(data.id);
  }, [data?.id, data?.paymentMethod, data?.status]);

  useEffect(() => {
    if (!data?.status) return;
    if (typeof window === "undefined") return;

    const notifyKey = `dordoi_order_notified_status_${orderId}`;
    const lastNotifiedStatus = window.localStorage.getItem(notifyKey);

    if (data.status === "confirmed" && lastNotifiedStatus !== "confirmed") {
      notifyUser("Заказ подтвержден", "Ресторан подтвердил ваш заказ.");
      window.localStorage.setItem(notifyKey, "confirmed");
    }

    if (data.status === "delivered" && lastNotifiedStatus !== "delivered") {
      notifyUser("Заказ доставлен", "Спасибо, что выбрали Dordoi Food.");
      window.localStorage.setItem(notifyKey, "delivered");
    }
  }, [data?.status, orderId]);

  useEffect(() => {
    if (!data || orderMissing || isHistoryStatus(data.status)) return;
    const timer = setInterval(() => void loadOrder(true), 4000);
    return () => clearInterval(timer);
  }, [data, orderMissing, loadOrder]);

  const statusMeta = useMemo(() => getOrderStatusMeta(data?.status ?? ""), [data?.status]);
  const menuSlug = data?.restaurant?.slug ?? history[0]?.restaurant?.slug ?? "dordoi-food";
  const isArchived = isHistoryStatus(data?.status ?? "");
  const hasNoActiveOrder = !orderLoading && (orderMissing || !data);
  const canCancel = Boolean(data && !isArchived && data.status !== "delivered");

  async function cancelOrder() {
    if (!data) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${data.id}/cancel`, { method: "POST" });
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(j?.error ?? "Не удалось отменить заказ");

      removeOrderFromHistory(data.id);
      clearPendingPayOrderId(data.id);
      setLastOrderId(getLastOrderId());
      setData(null);
      setOrderMissing(true);
      await loadHistory();
      toast.success("Заказ отменен");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <main className="min-h-screen p-5 pb-40">
      <div className="mx-auto max-w-md space-y-4">
        <div className="text-3xl font-extrabold">Заказ</div>

        {orderLoading && !data ? (
          <Card className="p-4">
            <div className="text-sm text-black/60">Загрузка заказа...</div>
          </Card>
        ) : hasNoActiveOrder ? (
          <Card className="p-4">
            <div className="text-sm text-black/60">Активный заказ</div>
            <div className="mt-2 text-sm text-black/70">Нет активных заказов.</div>
            <div className="mt-3">
              <Link href={`/r/${menuSlug}`} className="block rounded-xl bg-black py-3 text-center font-semibold text-white">
                В меню
              </Link>
            </div>
          </Card>
        ) : !isArchived ? (
          <>
            <Card className="p-4">
              <div className="text-sm text-black/60">Статус</div>
              <div className="mt-2">
                <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${statusMeta.badgeClassName}`}>{statusMeta.label}</span>
              </div>

              <StatusProgress status={data?.status ?? ""} />

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="text-black/60">Итого</div>
                <div className="text-right font-bold">{formatKgs(data?.totalKgs ?? 0)}</div>
                <div className="text-black/60">Код оплаты</div>
                <div className="text-right font-bold">{data?.paymentCode ?? ""}</div>
                <div className="text-black/60">Способ оплаты</div>
                <div className="text-right">{data?.paymentMethod ?? "-"}</div>
                <div className="text-black/60">Телефон</div>
                <div className="text-right">{data?.customerPhone ?? "-"}</div>
                <div className="text-black/60">Время заказа</div>
                <div className="text-right">{data?.createdAt ? new Date(data.createdAt).toLocaleString() : "-"}</div>
                <div className="text-black/60">Обновлен</div>
                <div className="text-right">{data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "-"}</div>
              </div>

              <div className="mt-3 text-sm text-black/70">
                Проход <span className="font-bold">{data?.location?.line ?? ""}</span>, контейнер{" "}
                <span className="font-bold">{data?.location?.container ?? ""}</span>
                {data?.location?.landmark ? <> ({data.location.landmark})</> : null}
              </div>
              {data?.comment ? <div className="mt-1 text-sm text-black/55">Комментарий: {data.comment}</div> : null}

              <div className="mt-4 space-y-2">
                <Button variant="secondary" onClick={() => void loadOrder()} className="w-full">
                  Обновить
                </Button>
                {data?.paymentMethod === "qr_image" &&
                  (data?.status === "created" || data?.status === "pending_confirmation") && (
                    <Link
                      href={`/pay/${data.id}?code=${encodeURIComponent(data.paymentCode ?? "")}`}
                      className="block rounded-xl border border-black/15 bg-white py-3 text-center font-semibold text-black"
                    >
                      К оплате
                    </Link>
                  )}
                {canCancel && (
                  <Button variant="secondary" onClick={() => void cancelOrder()} disabled={cancelling} className="w-full text-rose-700">
                    {cancelling ? "Отменяем..." : "Отменить заказ"}
                  </Button>
                )}
                <Link href={`/r/${menuSlug}`} className="block rounded-xl bg-black py-3 text-center font-semibold text-white">
                  В меню
                </Link>
              </div>
            </Card>

            <div className="space-y-3">
              {(data?.items ?? []).map((it) => (
                <Card key={it.id} className="p-3">
                  <div className="flex gap-3">
                    <Photo src={it.photoUrl} alt={it.title} />
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-semibold">{it.title}</div>
                        <div className="font-bold">{formatKgs(it.priceKgs * it.qty)}</div>
                      </div>
                      <div className="mt-1 text-sm text-black/55">
                        {it.qty} x {formatKgs(it.priceKgs)}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <Card className="p-4">
            <div className="text-sm text-black/60">Активный заказ</div>
            <div className="mt-2 text-sm text-black/70">
              Этот заказ завершен и перенесен в историю. Оформите новый заказ в меню.
            </div>
            <div className="mt-3">
              <Link href={`/r/${menuSlug}`} className="block rounded-xl bg-black py-3 text-center font-semibold text-white">
                В меню
              </Link>
            </div>
          </Card>
        )}

        <Card className="p-4">
          <div className="text-sm font-semibold">История заказов</div>
          <div className="mt-3 space-y-2">
            {history.map((order) => {
              const meta = getOrderStatusMeta(order.status);
              return (
                <div key={order.id} className="rounded-2xl border border-black/10 bg-white/70 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">#{order.id.slice(-6)}</div>
                      <div className="text-xs text-black/50">{new Date(order.createdAt).toLocaleString()}</div>
                    </div>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.badgeClassName}`}>{meta.label}</span>
                  </div>
                  <div className="mt-2 text-sm text-black/70">
                    {order.restaurant?.name ?? "-"} - {formatKgs(order.totalKgs)} - {order.items.length} поз.
                  </div>
                  <div className="mt-1 text-xs text-black/55">
                    Проход {order.location?.line ?? "-"}, контейнер {order.location?.container ?? "-"}
                  </div>
                  <div className="mt-1 text-xs text-black/55">
                    Метод: {order.paymentMethod} - Код: {order.paymentCode} - Обновлен: {new Date(order.updatedAt).toLocaleString()}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-black/60">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2">
                        <span>{item.title}</span>
                        <span>
                          {item.qty} x {formatKgs(item.priceKgs)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {order.comment ? <div className="mt-1 text-xs text-black/55">Комментарий: {order.comment}</div> : null}
                </div>
              );
            })}
            {history.length === 0 && <div className="text-sm text-black/50">История заказов пока пуста.</div>}
          </div>
        </Card>
      </div>

      <ClientNav menuHref={`/r/${menuSlug}`} orderHref={lastOrderId ? `/order/${lastOrderId}` : null} />
    </main>
  );
}
