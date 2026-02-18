"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type SVGProps } from "react";
import toast from "react-hot-toast";
import { Button, Card } from "@/components/ui";
import { ClientNav } from "@/components/ClientNav";
import { clearPendingPayOrderId, removeOrderFromHistory, setPendingPayOrderId } from "@/lib/clientPrefs";
import { useCart } from "@/lib/cartStore";
import { buildMbankPayUrl, normalizeMbankNumber } from "@/lib/mbankLink";
import { formatKgs } from "@/lib/money";

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

function getEffectiveTotalKgs(order: OrderResp | null) {
  if (!order) return 0;

  const apiTotal = Number(order.totalKgs);
  if (Number.isFinite(apiTotal) && apiTotal > 0) return Math.round(apiTotal);

  const lines = order.items ?? [];
  return lines.reduce((sum, line) => {
    const qty = Number(line.qty);
    const priceKgs = Number(line.priceKgs);
    if (!Number.isFinite(qty) || !Number.isFinite(priceKgs)) return sum;
    return sum + Math.max(0, Math.round(qty)) * Math.max(0, Math.round(priceKgs));
  }, 0);
}

function BankButtonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="1.25" y="1.25" width="21.5" height="21.5" rx="6.75" fill="white" fillOpacity="0.16" stroke="white" strokeOpacity="0.42" strokeWidth="1.5" />
      <path d="M6.5 16.8V7.2L10.4 12.1L14.3 7.2V16.8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17.4" cy="15.4" r="2.1" fill="#F9C74F" />
    </svg>
  );
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

  const effectiveTotalKgs = useMemo(() => getEffectiveTotalKgs(data), [data]);
  const mbankNumber = useMemo(() => normalizeMbankNumber(data?.restaurant?.mbankNumber), [data?.restaurant?.mbankNumber]);

  const resolvedBankUrl = useMemo(() => {
    if (effectiveTotalKgs <= 0) return null;
    return buildMbankPayUrl({ totalKgs: effectiveTotalKgs, bankPhone: mbankNumber });
  }, [effectiveTotalKgs, mbankNumber]);

  const isApproved = data ? CONFIRMED_STATUSES.has(data.status) : false;
  const isCanceled = data?.status === "canceled";

  useEffect(() => {
    setPendingPayOrderId(orderId);
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
    if (!mbankNumber) {
      toast.error("Номер Mbank не настроен в админке");
      return;
    }

    window.location.assign(resolvedBankUrl);
  }

  async function copyBankNumber() {
    if (!mbankNumber || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(mbankNumber);
      toast.success("Номер скопирован");
    } catch {
      toast.error("Не удалось скопировать номер");
    }
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

      clearPendingPayOrderId(orderId);
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

            <div className="mt-3 rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2">
              <div className="text-xs text-black/55">Номер получателя:</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{mbankNumber ?? "Не настроен"}</div>
                <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => void copyBankNumber()} disabled={!mbankNumber}>
                  Копировать
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Button
                variant="ghost"
                onClick={goToBankPayment}
                disabled={!resolvedBankUrl || !mbankNumber || !data || effectiveTotalKgs <= 0 || cancelling}
                className="w-full border border-white/50 bg-gradient-to-r from-[#05A6B9] via-[#17C6C6] to-[#62E6CC] text-white shadow-[0_12px_28px_rgba(5,166,185,0.38)]"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/35">
                    <BankButtonIcon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold tracking-[0.02em] text-white">Перейти к Mbank</span>
                </div>
              </Button>
              <Button onClick={() => void markPaid()} disabled={loading || cancelling} className="w-full">
                {loading ? "Отправляем..." : "Я оплатил(а)"}
              </Button>
              <Button variant="secondary" onClick={() => void cancelOrder()} disabled={loading || cancelling} className="w-full text-rose-700">
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
