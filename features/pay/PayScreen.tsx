"use client";

import jsQR from "jsqr";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type SVGProps } from "react";
import toast from "react-hot-toast";
import { Button, Card } from "@/components/ui";
import { ClientNav } from "@/components/ClientNav";
import { clearPendingPayOrderId, removeOrderFromHistory, setPendingPayOrderId } from "@/lib/clientPrefs";
import { useCart } from "@/lib/cartStore";
import { formatKgs } from "@/lib/money";

type OrderResp = {
  id: string;
  status: string;
  totalKgs: number;
  payerName?: string;
  restaurant: { name: string; slug: string; qrImageUrl: string };
  items?: Array<{ qty: number; priceKgs: number }>;
};

type EmvField = { tag: string; value: string };

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ошибка";
}

function parseEmvPayload(payload: string): EmvField[] | null {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(payload.trim());
  const fields: EmvField[] = [];
  let cursor = 0;

  while (cursor < bytes.length) {
    if (cursor + 4 > bytes.length) return null;
    const tag = decoder.decode(bytes.slice(cursor, cursor + 2));
    const lenText = decoder.decode(bytes.slice(cursor + 2, cursor + 4));
    if (!/^\d{2}$/.test(lenText)) return null;

    const len = Number(lenText);
    const valueStart = cursor + 4;
    const valueEnd = valueStart + len;
    if (valueEnd > bytes.length) return null;

    fields.push({ tag, value: decoder.decode(bytes.slice(valueStart, valueEnd)) });
    cursor = valueEnd;
  }

  return fields;
}

function parseAmountFromBankUrl(rawUrl: string | null) {
  if (!rawUrl) return null;

  try {
    const parsedUrl = new URL(rawUrl);

    if (parsedUrl.hostname === "app.mbank.kg" && parsedUrl.pathname.startsWith("/qr")) {
      const rawHash = parsedUrl.hash.startsWith("#") ? parsedUrl.hash.slice(1) : parsedUrl.hash;
      if (!rawHash) return null;

      const payload = decodeURIComponent(rawHash).trim();
      const fields = parseEmvPayload(payload);
      const amountRaw = fields?.find((field) => field.tag === "54")?.value?.trim();
      if (!amountRaw) return null;

      if (/^\d+\.\d{1,2}$/.test(amountRaw)) {
        const asDecimal = Number(amountRaw);
        return Number.isFinite(asDecimal) ? Math.max(0, Math.round(asDecimal)) : null;
      }

      if (/^\d+$/.test(amountRaw)) {
        const asInt = Number(amountRaw);
        if (!Number.isFinite(asInt)) return null;
        return amountRaw.length >= 4 ? Math.max(0, Math.round(asInt / 100)) : Math.max(0, Math.round(asInt));
      }
    }

    const amountKeys = ["amount", "sum", "total", "totalAmount", "invoiceAmount"];
    for (const key of amountKeys) {
      const value = parsedUrl.searchParams.get(key)?.trim();
      if (!value) continue;

      const parsed = Number(value.replace(",", "."));
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.round(parsed);
      }
    }
  } catch {
    return null;
  }

  return null;
}

function getEffectiveTotalKgs(order: OrderResp | null, bankAmountKgs: number | null) {
  if (!order) return 0;

  const apiTotal = Number(order.totalKgs);
  if (Number.isFinite(apiTotal) && apiTotal > 0) {
    return Math.round(apiTotal);
  }

  const lines = order.items ?? [];
  const linesTotal = lines.reduce((sum, line) => {
    const qty = Number(line.qty);
    const priceKgs = Number(line.priceKgs);
    if (!Number.isFinite(qty) || !Number.isFinite(priceKgs)) return sum;
    return sum + Math.max(0, Math.round(qty)) * Math.max(0, Math.round(priceKgs));
  }, 0);

  if (linesTotal > 0) return Math.max(0, linesTotal);
  if (typeof bankAmountKgs === "number" && Number.isFinite(bankAmountKgs) && bankAmountKgs > 0) {
    return Math.round(bankAmountKgs);
  }

  return 0;
}

function isLikelyUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    return Boolean(parsed.protocol);
  } catch {
    return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed);
  }
}

async function decodeQrLinkFromImage(imageUrl: string) {
  if (typeof window === "undefined") return null;

  const resolvedUrl = imageUrl.startsWith("http") ? imageUrl : new URL(imageUrl, window.location.origin).toString();
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load QR image"));
    image.src = resolvedUrl;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const scales = [1, 0.8, 0.6, 1.4];
  for (const scale of scales) {
    const width = Math.max(120, Math.round(img.width * scale));
    const height = Math.max(120, Math.round(img.height * scale));
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth"
    });

    if (result?.data?.trim()) return result.data.trim();
  }

  return null;
}

function serializeEmvPayload(fields: EmvField[]) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  let totalLen = 0;

  for (const { tag, value } of fields) {
    if (!/^\d{2}$/.test(tag)) return null;

    const valueBytes = encoder.encode(value);
    if (valueBytes.length > 99) return null;

    const head = encoder.encode(`${tag}${String(valueBytes.length).padStart(2, "0")}`);
    chunks.push(head, valueBytes);
    totalLen += head.length + valueBytes.length;
  }

  const merged = new Uint8Array(totalLen);
  let cursor = 0;
  for (const chunk of chunks) {
    merged.set(chunk, cursor);
    cursor += chunk.length;
  }
  return decoder.decode(merged);
}

function crc16ccitt(input: string) {
  const bytes = new TextEncoder().encode(input);
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i] << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function withMbankAmount(rawUrl: string, amountSom: number) {
  try {
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.hostname !== "app.mbank.kg" || !parsedUrl.pathname.startsWith("/qr")) {
      return null;
    }

    const rawHash = parsedUrl.hash.startsWith("#") ? parsedUrl.hash.slice(1) : parsedUrl.hash;
    if (!rawHash) return null;

    const payload = decodeURIComponent(rawHash).trim();
    const fields = parseEmvPayload(payload);
    if (!fields) return null;

    const withoutCrc = fields.filter((field) => field.tag !== "63");
    const amountIndex = withoutCrc.findIndex((field) => field.tag === "54");
    const existingAmountValue = amountIndex >= 0 ? withoutCrc[amountIndex].value : "";

    let amountValue = String(Math.max(0, Math.round(amountSom * 100)));
    if (/^\d+$/.test(existingAmountValue)) {
      amountValue = existingAmountValue.length >= 4 ? String(Math.max(0, Math.round(amountSom * 100))) : String(Math.max(0, Math.round(amountSom)));
    } else if (/^\d+\.\d{1,2}$/.test(existingAmountValue)) {
      amountValue = amountSom.toFixed(2);
    }

    if (amountIndex >= 0) {
      withoutCrc[amountIndex] = { ...withoutCrc[amountIndex], value: amountValue };
    } else {
      const merchantNameIndex = withoutCrc.findIndex((field) => field.tag === "59");
      if (merchantNameIndex >= 0) {
        withoutCrc.splice(merchantNameIndex, 0, { tag: "54", value: amountValue });
      } else {
        withoutCrc.push({ tag: "54", value: amountValue });
      }
    }

    const serializedWithoutCrc = serializeEmvPayload(withoutCrc);
    if (!serializedWithoutCrc) return null;

    const payloadWithCrcSeed = `${serializedWithoutCrc}6304`;
    const crc = crc16ccitt(payloadWithCrcSeed);
    const updatedPayload = `${payloadWithCrcSeed}${crc}`;

    parsedUrl.hash = `#${encodeURIComponent(updatedPayload)}`;
    return parsedUrl.toString();
  } catch {
    return null;
  }
}

function withAutoAmount(rawUrl: string, totalKgs: number) {
  const numericTotal = typeof totalKgs === "number" ? totalKgs : Number(totalKgs);
  const amountSom = Number.isFinite(numericTotal) ? Math.max(0, Math.round(numericTotal)) : 0;
  if (!rawUrl || amountSom <= 0) return rawUrl;

  try {
    const mbankUrl = withMbankAmount(rawUrl, amountSom);
    if (mbankUrl) return mbankUrl;

    const parsed = new URL(rawUrl);
    const amountText = String(amountSom);
    const knownAmountKeys = ["amount", "sum", "total", "totalAmount", "invoiceAmount"];
    let replacedKnownKey = false;

    for (const key of knownAmountKeys) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, amountText);
        replacedKnownKey = true;
      }
    }

    if (!replacedKnownKey) {
      parsed.searchParams.set("amount", amountText);
      parsed.searchParams.set("sum", amountText);
    }

    return parsed.toString();
  } catch {
    return rawUrl;
  }
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
  const [bankPayUrl, setBankPayUrl] = useState<string | null>(null);
  const [payerName, setPayerName] = useState("");
  const [resolvingBankUrl, setResolvingBankUrl] = useState(false);
  const router = useRouter();
  const clearCart = useCart((state) => state.clear);
  const amountFromBankUrl = useMemo(() => parseAmountFromBankUrl(bankPayUrl), [bankPayUrl]);
  const effectiveTotalKgs = useMemo(() => getEffectiveTotalKgs(data, amountFromBankUrl), [amountFromBankUrl, data]);

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
    const timer = window.setInterval(() => void loadOrder(), 4000);

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
    const qrImageUrl = data?.restaurant?.qrImageUrl;
    if (!qrImageUrl) {
      setBankPayUrl(null);
      return;
    }

    let cancelled = false;

    const resolveQr = async () => {
      setResolvingBankUrl(true);
      setBankPayUrl(null);

      try {
        const value = await decodeQrLinkFromImage(qrImageUrl);
        if (cancelled) return;
        setBankPayUrl(value && isLikelyUrl(value) ? value : null);
      } catch {
        if (!cancelled) setBankPayUrl(null);
      } finally {
        if (!cancelled) setResolvingBankUrl(false);
      }
    };

    void resolveQr();
    return () => {
      cancelled = true;
    };
  }, [data?.restaurant?.qrImageUrl]);

  const menuHref = data?.restaurant?.slug ? `/r/${data.restaurant.slug}` : "/";

  function goToOrder() {
    setNavigatingToOrder(true);
    window.setTimeout(() => {
      router.push(`/order/${orderId}`);
    }, 160);
  }

  function goToBankPayment() {
    if (!bankPayUrl) {
      toast.error("Ссылка оплаты банком не настроена");
      return;
    }
    if (!data || effectiveTotalKgs <= 0) {
      toast.error("Сумма заказа еще загружается");
      return;
    }

    const urlWithAmount = withAutoAmount(bankPayUrl, effectiveTotalKgs);
    window.location.assign(urlWithAmount);
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

      toast.success("Ожидаем подтверждения ресторана");
      clearPendingPayOrderId(orderId);
      clearCart();
      goToOrder();
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

  return (
    <main className="min-h-screen p-5 pb-36">
      <div className="mx-auto max-w-md">
        <div className="text-3xl font-extrabold">Оплата банком</div>
        <div className="mt-1 text-sm text-black/60">{data?.restaurant?.name ?? ""}</div>

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
          <div className="mt-1 text-[12px] text-black/45">Администратор увидит это имя при подтверждении оплаты.</div>

          <div className="mt-4 space-y-2">
            <Button onClick={() => void markPaid()} disabled={loading || navigatingToOrder || cancelling} className="w-full">
              Я оплатил(а)
            </Button>
            <Button
              variant="ghost"
              onClick={goToBankPayment}
              disabled={navigatingToOrder || resolvingBankUrl || !bankPayUrl || !data || effectiveTotalKgs <= 0 || cancelling}
              className="w-full border border-white/50 bg-gradient-to-r from-[#05A6B9] via-[#17C6C6] to-[#62E6CC] text-white shadow-[0_12px_28px_rgba(5,166,185,0.38)]"
            >
              <div className="flex items-center justify-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/35">
                  <BankButtonIcon className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold tracking-[0.02em] text-white">
                  {resolvingBankUrl ? "Готовим оплату..." : "Оплатить через MBANK"}
                </span>
              </div>
            </Button>
            <Button variant="secondary" onClick={() => void cancelOrder()} disabled={loading || navigatingToOrder || cancelling} className="w-full text-rose-700">
              {cancelling ? "Отменяем..." : "Отменить заказ"}
            </Button>
          </div>
        </Card>
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
