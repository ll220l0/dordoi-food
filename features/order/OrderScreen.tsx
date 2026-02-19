"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Photo } from "@/components/ui";
import { ClientNav } from "@/components/ClientNav";
import {
  clearActiveOrderId,
  clearPendingPayOrderId,
  getActiveOrderId,
  getLastOrderId,
  getOrderHistory,
  getPendingPayOrderId,
  getSavedPhone,
  setActiveOrderId,
  setPendingPayOrderId
} from "@/lib/clientPrefs";
import { formatKgs } from "@/lib/money";
import { paymentMethodLabel } from "@/lib/paymentMethod";
import { getOrderStatusMeta, isApprovedStatus, isHistoryStatus, isPendingConfirmation } from "@/lib/orderStatus";

type OrderItem = {
  id: string;
  menuItemId?: string;
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
  payerName?: string;
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
  payerName?: string;
  comment?: string;
  customerPhone?: string;
  location?: { line?: string; container?: string; landmark?: string };
  restaurant?: { name?: string; slug?: string };
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

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

function historyStatusIcon(status: string) {
  if (status === "delivered") {
    return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">✓</span>;
  }
  if (status === "canceled") {
    return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">×</span>;
  }
  return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">•</span>;
}

export default function OrderScreen({ orderId }: { orderId: string }) {
  const [data, setData] = useState<OrderData | null>(null);
  const [orderMissing, setOrderMissing] = useState(false);
  const [orderLoading, setOrderLoading] = useState(true);
  const [history, setHistory] = useState<HistoryOrder[]>([]);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [orderHref, setOrderHref] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [openedHistoryOrderId, setOpenedHistoryOrderId] = useState<string | null>(null);

  const loadOrder = useCallback(
    async (silent = false) => {
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
    },
    [orderId]
  );

  const loadHistory = useCallback(async () => {
    const ids = getOrderHistory()
      .map((entry) => entry.orderId)
      .filter(Boolean);
    const phone = getSavedPhone().replace(/\D/g, "").trim();

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
    const pendingPayOrderId = getPendingPayOrderId();
    if (pendingPayOrderId) {
      setLastOrderId(pendingPayOrderId);
      setOrderHref(`/pay/${pendingPayOrderId}`);
      return;
    }

    const activeOrderId = getActiveOrderId();
    if (activeOrderId) {
      setLastOrderId(activeOrderId);
      setOrderHref(`/order/${activeOrderId}`);
      return;
    }

    const lastOrderIdValue = getLastOrderId();
    setLastOrderId(lastOrderIdValue);
    setOrderHref(lastOrderIdValue ? `/order/${lastOrderIdValue}` : null);
  }, []);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, data?.status]);

  useEffect(() => {
    if (!data?.id) return;

    const isBankPayment = data.paymentMethod === "bank";
    const isPendingPayStatus = data.status === "created" || data.status === "pending_confirmation";

    if (isBankPayment && isPendingPayStatus) {
      setPendingPayOrderId(data.id);
      setActiveOrderId(data.id);
      setLastOrderId(data.id);
      setOrderHref(`/pay/${data.id}`);
      return;
    }

    clearPendingPayOrderId(data.id);
    if (isHistoryStatus(data.status)) {
      clearActiveOrderId(data.id);
    } else {
      setActiveOrderId(data.id);
    }
    setLastOrderId(data.id);
    setOrderHref(`/order/${data.id}`);
  }, [data?.id, data?.paymentMethod, data?.status]);

  useEffect(() => {
    if (!data || orderMissing || isHistoryStatus(data.status)) return;
    const timer = setInterval(() => void loadOrder(true), 4000);
    return () => clearInterval(timer);
  }, [data, orderMissing, loadOrder]);

  const statusMeta = useMemo(() => getOrderStatusMeta(data?.status ?? ""), [data?.status]);
  const menuSlug = data?.restaurant?.slug ?? history[0]?.restaurant?.slug ?? "dordoi-food";
  const isArchived = isHistoryStatus(data?.status ?? "");
  const hasNoActiveOrder = !orderLoading && (orderMissing || !data);

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
                <div className="text-black/60">Плательщик</div>
                <div className="text-right font-bold">{data?.payerName ?? "-"}</div>
                <div className="text-black/60">Способ оплаты</div>
                <div className="text-right">{paymentMethodLabel(data?.paymentMethod ?? "")}</div>
                <div className="text-black/60">Телефон</div>
                <div className="text-right">{data?.customerPhone ?? "-"}</div>
                <div className="text-black/60">Время заказа</div>
                <div className="text-right">{data?.createdAt ? new Date(data.createdAt).toLocaleString() : "-"}</div>
                <div className="text-black/60">Обновлен</div>
                <div className="text-right">{data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "-"}</div>
              </div>

              <div className="mt-3 text-sm text-black/70">
                Проход <span className="font-bold">{data?.location?.line ?? ""}</span>, контейнер <span className="font-bold">{data?.location?.container ?? ""}</span>
                {data?.location?.landmark ? <> ({data.location.landmark})</> : null}
              </div>
              {data?.comment ? <div className="mt-1 text-sm text-black/55">Комментарий: {data.comment}</div> : null}
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
            <div className="mt-2 text-sm text-black/70">Этот заказ завершен и перенесен в историю. Оформите новый заказ в меню.</div>
            <div className="mt-3">
              <Link href={`/r/${menuSlug}`} className="block rounded-xl bg-black py-3 text-center font-semibold text-white">
                В меню
              </Link>
            </div>
          </Card>
        )}

        <Card className="overflow-hidden p-0">
          <button className="flex w-full items-center justify-between px-4 py-4 text-left" onClick={() => setHistoryOpen((value) => !value)}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-700">↺</span>
              <span className="text-sm font-semibold">История заказов</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-black/45">{history.length}</span>
              <span className={`text-xs transition-transform ${historyOpen ? "rotate-180" : ""}`}>▼</span>
            </div>
          </button>

          {historyOpen && (
            <div className="border-t border-black/10 px-4 pb-4 pt-3">
              <div className="space-y-2">
                {history.map((order) => {
                  const isExpanded = openedHistoryOrderId === order.id;
                  const createdDate = new Date(order.createdAt);

                  return (
                    <div key={order.id} className="rounded-2xl border border-black/10 bg-white/70">
                      <button
                        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                        onClick={() => setOpenedHistoryOrderId((value) => (value === order.id ? null : order.id))}
                      >
                        <div className="w-6 shrink-0">{historyStatusIcon(order.status)}</div>
                        <div className="flex-1 text-center text-sm font-bold">{formatKgs(order.totalKgs)}</div>
                        <div className="w-28 shrink-0 text-right">
                          <div className="text-xs text-black/55">{createdDate.toLocaleDateString()}</div>
                          <div className="text-xs text-black/55">{createdDate.toLocaleTimeString()}</div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-black/10 px-3 pb-3 pt-2">
                          <div className="text-xs text-black/55">
                            {order.restaurant?.name ?? "-"} · {paymentMethodLabel(order.paymentMethod)}
                          </div>
                          <div className="mt-1 text-xs text-black/55">
                            Проход {order.location?.line ?? "-"}, контейнер {order.location?.container ?? "-"}
                          </div>
                          {order.comment ? <div className="mt-1 text-xs text-black/55">Комментарий: {order.comment}</div> : null}

                          <div className="mt-3 space-y-2">
                            {order.items.map((item) => (
                              <div key={item.id} className="flex items-center gap-2 rounded-xl border border-black/10 bg-white/70 p-2">
                                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-black/5 ring-1 ring-black/5">
                                  <Image src={item.photoUrl} alt={item.title} fill className="object-cover" sizes="40px" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-semibold">{item.title}</div>
                                  <div className="text-xs text-black/55">
                                    {item.qty} x {formatKgs(item.priceKgs)}
                                  </div>
                                </div>
                                <div className="text-sm font-bold">{formatKgs(item.priceKgs * item.qty)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {history.length === 0 && <div className="text-sm text-black/50">История заказов пока пуста.</div>}
              </div>
            </div>
          )}
        </Card>
      </div>

      <ClientNav menuHref={`/r/${menuSlug}`} orderHref={orderHref ?? (lastOrderId ? `/order/${lastOrderId}` : null)} />
    </main>
  );
}
