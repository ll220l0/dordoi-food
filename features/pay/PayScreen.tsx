"use client";

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
  restaurant: {
    name: string;
    slug: string;
    mbankNumber?: string;
    obankNumber?: string;
    bakaiNumber?: string;
  };
  items?: Array<{ qty: number; priceKgs: number }>;
};

type EmvField = { tag: string; value: string };
type BankOption = "mbank" | "obank" | "bakai";

const DEFAULT_MBANK_LINK =
  "https://app.mbank.kg/qr/#00020101021132500012c2c.mbank.kg01020210129969900900911202111302115204999953034175405100005910AKTILEK%20K.63046588";
const DEFAULT_O_BANK_LINK =
  "https://api.dengi.o.kg/#00020101021132680012p2p.dengi.kg01048580111258480211000910129965090009911202121302123410%D0%90%D0%9A%D0%A2%D0%98%D0%9B%D0%95%D0%9A%20%D0%9A.5204739953034175405100005906O%21Bank6304C840";
const DEFAULT_BAKAI_LINK =
  "https://bakai.app#00020101021132460011qr.bakai.kg010131016124207011463603813021233120008BAKAIAPP5204653853034175910Aktilek%20K.5405100006304B554";

const PHONE_RE = /^996\d{9}$/;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ошибка";
}

function normalizeBankNumber(value: string | null | undefined) {
  const digits = (value ?? "").replace(/[^\d]/g, "");
  if (!PHONE_RE.test(digits)) return null;
  return digits;
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

function withAutoAmountAndPhone(rawUrl: string, totalKgs: number, bankPhone: string | null) {
  const numericTotal = typeof totalKgs === "number" ? totalKgs : Number(totalKgs);
  const amountSom = Number.isFinite(numericTotal) ? Math.max(0, Math.round(numericTotal)) : 0;
  if (!rawUrl || amountSom <= 0) return rawUrl;

  try {
    const parsedUrl = new URL(rawUrl);
    const rawHash = parsedUrl.hash.startsWith("#") ? parsedUrl.hash.slice(1) : parsedUrl.hash;

    if (!rawHash) {
      parsedUrl.searchParams.set("amount", String(amountSom));
      parsedUrl.searchParams.set("sum", String(amountSom));
      return parsedUrl.toString();
    }

    let payload = decodeURIComponent(rawHash).trim();
    if (bankPhone) {
      payload = payload.replace(/996\d{9}/g, bankPhone);
    }

    const fields = parseEmvPayload(payload);
    if (!fields) {
      parsedUrl.searchParams.set("amount", String(amountSom));
      parsedUrl.searchParams.set("sum", String(amountSom));
      return parsedUrl.toString();
    }

    const withoutCrc = fields.filter((field) => field.tag !== "63");
    if (bankPhone) {
      for (let i = 0; i < withoutCrc.length; i += 1) {
        const field = withoutCrc[i]!;
        if (field.tag === "54") continue;
        withoutCrc[i] = { ...field, value: field.value.replace(/996\d{9}/g, bankPhone) };
      }
    }

    const amountIndex = withoutCrc.findIndex((field) => field.tag === "54");
    const existingAmountValue = amountIndex >= 0 ? withoutCrc[amountIndex].value : "";

    let amountValue = String(Math.max(0, Math.round(amountSom * 100)));
    if (/^\d+$/.test(existingAmountValue)) {
      if (existingAmountValue.length >= 4) {
        amountValue = String(Math.max(0, Math.round(amountSom * 100))).padStart(existingAmountValue.length, "0");
      } else {
        amountValue = String(Math.max(0, Math.round(amountSom)));
      }
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
    if (!serializedWithoutCrc) return rawUrl;

    const payloadWithCrcSeed = `${serializedWithoutCrc}6304`;
    const crc = crc16ccitt(payloadWithCrcSeed);
    const updatedPayload = `${payloadWithCrcSeed}${crc}`;

    parsedUrl.hash = `#${encodeURIComponent(updatedPayload)}`;
    return parsedUrl.toString();
  } catch {
    return rawUrl;
  }
}

function getEffectiveTotalKgs(order: OrderResp | null) {
  if (!order) return 0;

  const apiTotal = Number(order.totalKgs);
  if (Number.isFinite(apiTotal) && apiTotal > 0) {
    return Math.round(apiTotal);
  }

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
  const [selectedBank, setSelectedBank] = useState<BankOption>("mbank");
  const [payerName, setPayerName] = useState("");
  const router = useRouter();
  const clearCart = useCart((state) => state.clear);

  const effectiveTotalKgs = useMemo(() => getEffectiveTotalKgs(data), [data]);

  const mbankTemplate = (process.env.NEXT_PUBLIC_MBANK_PAY_URL ?? DEFAULT_MBANK_LINK).trim();
  const obankTemplate = (process.env.NEXT_PUBLIC_OBANK_PAY_URL ?? DEFAULT_O_BANK_LINK).trim();
  const bakaiTemplate = (process.env.NEXT_PUBLIC_BAKAI_PAY_URL ?? DEFAULT_BAKAI_LINK).trim();

  const selectedBankLabel = useMemo(() => {
    if (selectedBank === "mbank") return "Mbank";
    if (selectedBank === "obank") return "O bank";
    return "Bakai Bank";
  }, [selectedBank]);

  const selectedBankNumber = useMemo(() => {
    if (selectedBank === "mbank") return normalizeBankNumber(data?.restaurant?.mbankNumber);
    if (selectedBank === "obank") return normalizeBankNumber(data?.restaurant?.obankNumber);
    return normalizeBankNumber(data?.restaurant?.bakaiNumber);
  }, [data?.restaurant?.bakaiNumber, data?.restaurant?.mbankNumber, data?.restaurant?.obankNumber, selectedBank]);

  const selectedBankTemplate = useMemo(() => {
    if (selectedBank === "mbank") return mbankTemplate || null;
    if (selectedBank === "obank") return obankTemplate || null;
    return bakaiTemplate || null;
  }, [bakaiTemplate, mbankTemplate, obankTemplate, selectedBank]);

  const resolvedBankUrl = useMemo(() => {
    if (!selectedBankTemplate) return null;
    if (effectiveTotalKgs <= 0) return selectedBankTemplate;
    const phoneForPayload = selectedBank === "mbank" ? selectedBankNumber : null;
    return withAutoAmountAndPhone(selectedBankTemplate, effectiveTotalKgs, phoneForPayload);
  }, [effectiveTotalKgs, selectedBank, selectedBankNumber, selectedBankTemplate]);

  useEffect(() => {
    setPendingPayOrderId(orderId);
  }, [orderId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("bank");
    if (raw === "mbank" || raw === "obank" || raw === "bakai") {
      setSelectedBank(raw);
    }
  }, []);

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

  const menuHref = data?.restaurant?.slug ? `/r/${data.restaurant.slug}` : "/";

  function goToOrder() {
    setNavigatingToOrder(true);
    window.setTimeout(() => {
      router.push(`/order/${orderId}`);
    }, 160);
  }

  function goToBankPayment() {
    if (!resolvedBankUrl) {
      toast.error("Ссылка оплаты банком не настроена");
      return;
    }
    if (!data || effectiveTotalKgs <= 0) {
      toast.error("Сумма заказа еще загружается");
      return;
    }
    if (!selectedBankNumber) {
      toast.error("Номер банка не настроен в админке");
      return;
    }

    window.location.assign(resolvedBankUrl);
  }

  async function copyBankNumber() {
    if (!selectedBankNumber || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(selectedBankNumber);
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

          <div className="mt-3 text-xs text-black/55">Выбери банк:</div>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="radio" name="payBank" checked={selectedBank === "mbank"} onChange={() => setSelectedBank("mbank")} />
            Mbank
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="radio" name="payBank" checked={selectedBank === "obank"} onChange={() => setSelectedBank("obank")} />
            O bank
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="radio" name="payBank" checked={selectedBank === "bakai"} onChange={() => setSelectedBank("bakai")} />
            Bakai Bank
          </label>

          <div className="mt-3 rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2">
            <div className="text-xs text-black/55">Номер получателя:</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">{selectedBankNumber ?? "Не настроен"}</div>
              <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => void copyBankNumber()} disabled={!selectedBankNumber}>
                Копировать
              </Button>
            </div>
          </div>

          <div className="mt-1 text-[12px] text-black/45">Администратор увидит имя отправителя при подтверждении оплаты.</div>

          <div className="mt-4 space-y-2">
            <Button onClick={() => void markPaid()} disabled={loading || navigatingToOrder || cancelling} className="w-full">
              Я оплатил(а)
            </Button>
            <Button
              variant="ghost"
              onClick={goToBankPayment}
              disabled={navigatingToOrder || !resolvedBankUrl || !selectedBankNumber || !data || effectiveTotalKgs <= 0 || cancelling}
              className="w-full border border-white/50 bg-gradient-to-r from-[#05A6B9] via-[#17C6C6] to-[#62E6CC] text-white shadow-[0_12px_28px_rgba(5,166,185,0.38)]"
            >
              <div className="flex items-center justify-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/35">
                  <BankButtonIcon className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold tracking-[0.02em] text-white">{`Оплатить через ${selectedBankLabel}`}</span>
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

