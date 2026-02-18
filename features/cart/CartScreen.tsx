"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button, Card, Photo } from "@/components/ui";
import { ClientNav } from "@/components/ClientNav";
import { useCart } from "@/lib/cartStore";
import {
  addOrderToHistory,
  setActiveOrderId,
  clearPendingPayOrderId,
  getSavedLocation,
  getSavedPhone,
  setSavedLocation,
  setPendingPayOrderId,
  setSavedPhone
} from "@/lib/clientPrefs";
import { formatKgs } from "@/lib/money";

type PaymentMethod = "bank" | "cash";

type CreateOrderResponse = {
  orderId: string;
  bankPayUrl?: string | null;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ошибка";
}

function normalizeKgPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const rest = digits.startsWith("996") ? digits.slice(3) : digits;
  const normalized = `996${rest}`.slice(0, 12);
  return /^996\d{9}$/.test(normalized) ? normalized : null;
}

function formatKgPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const rest = digits.startsWith("996") ? digits.slice(3) : digits;
  const normalized = `996${rest}`.slice(0, 12);
  const local = normalized.slice(3);

  if (local.length === 0) return "996";
  if (local.length <= 3) return `996 (${local}`;
  if (local.length <= 6) return `996 (${local.slice(0, 3)}) ${local.slice(3)}`;
  return `996 (${local.slice(0, 3)}) ${local.slice(3, 6)} - ${local.slice(6, 9)}`;
}

export default function CartScreen() {
  const restaurantSlug = useCart((state) => state.restaurantSlug);
  const lines = useCart((state) => state.lines);
  const total = useCart((state) => state.total());
  const count = useCart((state) => state.count());
  const inc = useCart((state) => state.inc);
  const dec = useCart((state) => state.dec);
  const clear = useCart((state) => state.clear);

  const [line, setLine] = useState("");
  const [container, setContainer] = useState("");
  const [landmark, setLandmark] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [comment, setComment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank");
  const [loading, setLoading] = useState(false);
  const [redirectingTo, setRedirectingTo] = useState<"pay" | "order" | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
    setCustomerPhone(formatKgPhone(getSavedPhone()));
    const savedLocation = getSavedLocation();
    setLine(savedLocation.line);
    setContainer(savedLocation.container);
  }, []);

  const canSubmit = useMemo(() => {
    return Boolean(
      isHydrated &&
        restaurantSlug &&
        lines.length > 0 &&
        line.trim().length > 0 &&
        container.trim().length > 0 &&
        Boolean(normalizeKgPhone(customerPhone)) &&
        !loading
    );
  }, [container, customerPhone, isHydrated, line, lines.length, loading, restaurantSlug]);

  if (!isHydrated) {
    return (
      <main className="min-h-screen p-5 pb-36">
        <div className="mx-auto max-w-md">
          <div className="text-2xl font-extrabold">Корзина</div>
          <Card className="mt-4 p-4">
            <div className="text-sm text-black/60">Загружаем корзину...</div>
          </Card>
        </div>
      </main>
    );
  }

  async function submitOrder() {
    if (!restaurantSlug || lines.length === 0) {
      toast.error("Корзина пуста");
      return;
    }

    const phone = normalizeKgPhone(customerPhone.trim());
    if (!line.trim() || !container.trim()) {
      toast.error("Заполни проход и контейнер");
      return;
    }
    if (!phone) {
      toast.error("Укажи телефон в формате 996 (xxx) xxx - xxx");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        restaurantSlug,
        paymentMethod,
        customerPhone: phone,
        comment: comment.trim(),
        location: {
          line: line.trim(),
          container: container.trim(),
          landmark: landmark.trim()
        },
        items: lines.map((x) => ({ menuItemId: x.menuItemId, qty: x.qty }))
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const j = (await res.json().catch(() => null)) as Partial<CreateOrderResponse> & { error?: string } | null;
      if (!res.ok || !j?.orderId) throw new Error(j?.error ?? "Не удалось создать заказ");

      addOrderToHistory({
        orderId: j.orderId,
        restaurantSlug,
        customerPhone: phone,
        totalKgs: total,
        createdAt: new Date().toISOString(),
        lines
      });
      setActiveOrderId(j.orderId);
      setSavedPhone(phone);
      setSavedLocation({ line: line.trim(), container: container.trim() });
      clear();

      if (paymentMethod === "bank") {
        setPendingPayOrderId(j.orderId);
      } else {
        clearPendingPayOrderId();
      }

      const nextUrl = paymentMethod === "bank" ? `/pay/${j.orderId}` : `/order/${j.orderId}`;
      setRedirectingTo(paymentMethod === "bank" ? "pay" : "order");
      window.setTimeout(() => {
        window.location.assign(nextUrl);
      }, 180);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  if (lines.length === 0) {
    return (
      <main className="min-h-screen p-5 pb-36">
        <div className="mx-auto max-w-md">
          <div className="text-2xl font-extrabold">Корзина</div>
          <Card className="mt-4 p-4">
            <div className="text-sm text-black/60">В корзине пока ничего нет.</div>
            <Link href={restaurantSlug ? `/r/${restaurantSlug}` : "/"} className="mt-3 block">
              <Button className="w-full">Вернуться в меню</Button>
            </Link>
          </Card>
        </div>
        <ClientNav menuHref={restaurantSlug ? `/r/${restaurantSlug}` : "/"} />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-5 pb-40">
      <div className="mx-auto max-w-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-black/50">Оформление</div>
            <div className="text-3xl font-extrabold">Корзина</div>
          </div>
          <Link className="mt-2 text-sm text-black/60 underline" href={restaurantSlug ? `/r/${restaurantSlug}` : "/"}>
            В меню
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {lines.map((lineItem) => (
            <Card key={lineItem.menuItemId} className="p-3">
              <div className="flex gap-3">
                <Photo src={lineItem.photoUrl} alt={lineItem.title} />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold">{lineItem.title}</div>
                    <div className="font-bold">{formatKgs(lineItem.priceKgs * lineItem.qty)}</div>
                  </div>
                  <div className="mt-1 text-sm text-black/55">
                    {formatKgs(lineItem.priceKgs)} x {lineItem.qty}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button variant="secondary" className="px-3 py-1" onClick={() => dec(lineItem.menuItemId)}>
                      -
                    </Button>
                    <Button variant="secondary" className="px-3 py-1" onClick={() => inc(lineItem.menuItemId)}>
                      +
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="mt-4 p-4">
          <div className="text-sm font-semibold">Куда доставить</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-3"
              placeholder="Проход"
              value={line}
              onChange={(e) => setLine(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-3"
              placeholder="Контейнер"
              value={container}
              onChange={(e) => setContainer(e.target.value)}
            />
          </div>
          <input
            className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-3"
            placeholder="Ориентир (необязательно)"
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
          />
          <input
            className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-3"
            placeholder="996 (___) ___ - ___"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(formatKgPhone(e.target.value))}
            inputMode="tel"
            required
          />
          <input
            className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-3"
            placeholder="Комментарий (необязательно)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </Card>

        <Card className="mt-4 p-4">
          <div className="text-sm font-semibold">Оплата</div>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="radio" name="paymentMethod" checked={paymentMethod === "bank"} onChange={() => setPaymentMethod("bank")} />
            Банком
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="radio" name="paymentMethod" checked={paymentMethod === "cash"} onChange={() => setPaymentMethod("cash")} />
            Наличными курьеру
          </label>
          {paymentMethod === "bank" && <div className="mt-3 text-xs text-black/55">Имя отправителя укажете на экране оплаты Mbank</div>}
        </Card>

        <Card className="mt-4 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-black/60">Позиций</div>
            <div className="font-semibold">{count}</div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="text-sm text-black/60">Итого</div>
            <div className="text-xl font-extrabold">{formatKgs(total)}</div>
          </div>
          <Button className="mt-4 w-full" disabled={!canSubmit} onClick={submitOrder}>
            {loading ? "Создаем заказ..." : paymentMethod === "bank" ? "К оплате Mbank" : "Оформить заказ"}
          </Button>
        </Card>
      </div>

      <ClientNav menuHref={restaurantSlug ? `/r/${restaurantSlug}` : "/"} />

      {redirectingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/75 backdrop-blur-md">
          <div className="rounded-2xl border border-black/10 bg-white px-6 py-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
            <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-black/60 border-t-transparent" />
            <div className="mt-3 text-sm font-semibold text-black/70">
              {redirectingTo === "pay" ? "Открываем оплату..." : "Переходим к заказу..."}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
