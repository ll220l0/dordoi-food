"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button, Card } from "@/components/ui";
import { ClientNav } from "@/components/ClientNav";
import {
  clearActiveOrderId,
  clearPendingPayOrderId,
  getOrderHistoryEntry,
  getSavedPayerName,
  removeOrderFromHistory,
  setActiveOrderId,
  setPendingPayOrderId,
  setSavedPayerName
} from "@/lib/clientPrefs";
import { useCart } from "@/lib/cartStore";
import { buildMbankPayUrl, normalizeMbankNumber } from "@/lib/mbankLink";
import { formatKgs } from "@/lib/money";
import { isHistoryStatus } from "@/lib/orderStatus";

type OrderResp = {
  id: string;
  status: "created" | "pending_confirmation" | "confirmed" | "cooking" | "delivering" | "delivered" | "canceled";
  totalKgs: number;
  payerName?: string;
  restaurant: {
    name: string;
    slug: string;
    mbankNumber?: string;
  };
  items?: Array<{ qty: number; priceKgs: number }>;
};

const CONFIRMED_STATUSES = new Set<OrderResp["status"]>(["confirmed", "cooking", "delivering", "delivered"]);

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ошибка";
}

function getEffectiveTotalKgs(order: OrderResp | null, fallbackTotalKgs = 0) {
  if (!order) return fallbackTotalKgs;

  const apiTotal = Number(order.totalKgs);
  if (Number.isFinite(apiTotal) && apiTotal > 0) return Math.round(apiTotal);

  const lines = order.items ?? [];
  const computedFromItems = lines.reduce((sum, line) => {
    const qty = Number(line.qty);
    const priceKgs = Number(line.priceKgs);
    if (!Number.isFinite(qty) || !Number.isFinite(priceKgs)) return sum;
    return sum + Math.max(0, Math.round(qty)) * Math.max(0, Math.round(priceKgs));
  }, 0);
  if (computedFromItems > 0) return computedFromItems;
  return fallbackTotalKgs;
}

export default function PayScreen({ orderId }: { orderId: string }) {
  const [data, setData] = useState<OrderResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [navigatingToOrder, setNavigatingToOrder] = useState(false);
  const [payerName, setPayerName] = useState("");
  const [waitingForAdmin, setWaitingForAdmin] = useState(false);
  const [showApprovedCheck, setShowApprovedCheck] = useState(false);
  const router = useRouter();
  const clearCart = useCart((state) => state.clear);
  const historyTotalKgs = useMemo(() => {
    const totalFromHistory = getOrderHistoryEntry(orderId)?.totalKgs ?? 0;
    const parsed = Number(totalFromHistory);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
  }, [orderId]);

  const effectiveTotalKgs = useMemo(() => getEffectiveTotalKgs(data, historyTotalKgs), [data, historyTotalKgs]);
  const mbankNumber = useMemo(() => normalizeMbankNumber(data?.restaurant?.mbankNumber), [data?.restaurant?.mbankNumber]);

  const resolvedBankUrl = useMemo(() => {
    if (effectiveTotalKgs <= 0) return null;
    return buildMbankPayUrl({ totalKgs: effectiveTotalKgs, bankPhone: mbankNumber });
  }, [effectiveTotalKgs, mbankNumber]);

  const isApproved = data ? CONFIRMED_STATUSES.has(data.status) : false;
  const isCanceled = data?.status === "canceled";

  useEffect(() => {
    setPendingPayOrderId(orderId);
    setActiveOrderId(orderId);
  }, [orderId]);

  useEffect(() => {
    let stopped = false;

    const loadOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        if (!res.ok) return;
        const response = (await res.json()) as OrderResp;
        if (!stopped) setData(response);
      } catch {
        // Ignore transient polling failures.
      }
    };

    void loadOrder();
    const timer = window.setInterval(() => void loadOrder(), 3500);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [orderId]);

  useEffect(() => {
    const savedName = getSavedPayerName().trim();
    if (savedName) setPayerName(savedName);
  }, []);

  useEffect(() => {
    if (data?.payerName && !payerName.trim()) {
      setPayerName(data.payerName);
    }
  }, [data?.payerName, payerName]);

  useEffect(() => {
    if (data?.status === "pending_confirmation") {
      setWaitingForAdmin(true);
    }
  }, [data?.status]);

  useEffect(() => {
    if (!data) return;
    if (isHistoryStatus(data.status)) {
      clearActiveOrderId(orderId);
      return;
    }
    setActiveOrderId(orderId);
  }, [data, orderId]);

  useEffect(() => {
    if (!data) return;
    if (CONFIRMED_STATUSES.has(data.status) || data.status === "canceled") {
      clearPendingPayOrderId(orderId);
    }
  }, [data, orderId]);

  useEffect(() => {
    if (!isApproved) {
      setShowApprovedCheck(false);
      return;
    }

    const timer = window.setTimeout(() => setShowApprovedCheck(true), 120);
    return () => window.clearTimeout(timer);
  }, [isApproved]);

  const menuHref = data?.restaurant?.slug ? `/r/${data.restaurant.slug}` : "/";

  function openOrder() {
    setNavigatingToOrder(true);
    window.setTimeout(() => {
      router.push(`/order/${orderId}`);
    }, 120);
  }

  function goToBankPayment() {
    if (!resolvedBankUrl) {
      toast.error("Ссылка оплаты Mbank не настроена");
      return;
    }
    if (!data || effectiveTotalKgs <= 0) {
      toast.error("Сумма заказа еще загружается");
      return;
    }

    window.location.assign(resolvedBankUrl);
  }

  async function markPaid() {
    const payer = payerName.trim();
    if (payer.length < 2) {
      toast.error("Укажи имя отправителя перевода");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/mark-paid`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payerName: payer })
      });
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(j?.error ?? "Ошибка");

      setSavedPayerName(payer);
      clearCart();
      setWaitingForAdmin(true);
      toast.success("Ожидаем подтверждения администратора");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function cancelOrder() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(j?.error ?? "Не удалось отменить заказ");

      clearActiveOrderId(orderId);
      clearPendingPayOrderId(orderId);
      removeOrderFromHistory(orderId);
      toast.success("Заказ отменен");
      router.replace("/order");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setCancelling(false);
    }
  }

  const showWaitingCard = waitingForAdmin && !isApproved && !isCanceled;
  const showPayCard = !showWaitingCard && !isApproved && !isCanceled;

  return (
    <main className="min-h-screen p-5 pb-36">
      <div className="mx-auto max-w-md">
        <div className="text-3xl font-extrabold">Оплата банком</div>
        <div className="mt-1 text-sm text-black/60">{data?.restaurant?.name ?? ""}</div>

        {showPayCard && (
          <Card className="mt-4 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-black/60">Итого</div>
              <div className="text-xl font-extrabold">{formatKgs(effectiveTotalKgs)}</div>
            </div>

            <input
              className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-3"
              placeholder="Имя отправителя перевода"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
            />

            <div className="mt-3 text-xs text-black/55">Банк: Mbank</div>

            <div className="mt-4 space-y-2">
              <Button
                variant="ghost"
                onClick={goToBankPayment}
                disabled={!resolvedBankUrl || !data || effectiveTotalKgs <= 0 || cancelling}
                className="h-12 w-full border border-white/50 bg-gradient-to-r from-[#05A6B9] via-[#17C6C6] to-[#62E6CC] py-0 text-white shadow-[0_12px_28px_rgba(5,166,185,0.38)]"
                aria-label="Перейти к Mbank"
              >
                <div className="flex items-center justify-center">
                  <Image
                    src="/mbank-logo-white.svg"
                    alt="Mbank"
                    width={132}
                    height={32}
                    className="h-7 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.22)]"
                    priority
                  />
                </div>
              </Button>
              <Button onClick={() => void markPaid()} disabled={loading || cancelling} className="h-12 w-full py-0">
                {loading ? "Отправляем..." : "Я оплатил(а)"}
              </Button>
              <Button variant="secondary" onClick={() => void cancelOrder()} disabled={loading || cancelling} className="h-12 w-full py-0 text-rose-700">
                {cancelling ? "Отменяем..." : "Отменить заказ"}
              </Button>
            </div>
          </Card>
        )}

        {showWaitingCard && (
          <Card className="mt-4 p-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-black/50 border-t-transparent" />
              <div className="mt-3 text-lg font-bold">Проверяем оплату</div>
              <div className="mt-1 text-sm text-black/60">Ожидаем подтверждения администратора...</div>
            </div>
          </Card>
        )}

        {isApproved && (
          <Card className="mt-4 p-6">
            <div className="flex flex-col items-center text-center">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-2xl text-white transition-all duration-500 ${
                  showApprovedCheck ? "scale-100 opacity-100" : "scale-75 opacity-0"
                }`}
              >
                ✓
              </div>
              <div className="mt-3 text-lg font-bold text-emerald-700">Оплата подтверждена</div>
              <div className="mt-1 text-sm text-black/60">Заказ принят в работу.</div>
              <Button className="mt-4 w-full" onClick={openOrder}>
                К заказу
              </Button>
            </div>
          </Card>
        )}

        {isCanceled && (
          <Card className="mt-4 p-6">
            <div className="text-center">
              <div className="text-lg font-bold text-rose-700">Заказ отменен</div>
              <Button className="mt-4 w-full" onClick={() => router.replace(`/r/${data?.restaurant?.slug ?? ""}`)}>
                В меню
              </Button>
            </div>
          </Card>
        )}
      </div>

      <ClientNav menuHref={menuHref} orderHref={`/pay/${orderId}`} />

      {navigatingToOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/75 backdrop-blur-md">
          <div className="rounded-2xl border border-black/10 bg-white px-6 py-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-black/60 border-t-transparent" />
            <div className="mt-3 text-sm font-semibold text-black/70">Переходим к заказу...</div>
          </div>
        </div>
      )}
    </main>
  );
}
