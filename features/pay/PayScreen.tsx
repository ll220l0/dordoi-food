"use client";

import jsQR from "jsqr";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button, Card } from "@/components/ui";
import { ClientNav } from "@/components/ClientNav";
import { clearPendingPayOrderId, setPendingPayOrderId } from "@/lib/clientPrefs";
import { useCart } from "@/lib/cartStore";
import { formatKgs } from "@/lib/money";

type OrderResp = {
  id: string;
  status: string;
  totalKgs: number;
  paymentCode: string;
  restaurant: { name: string; slug: string; qrImageUrl: string };
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ошибка";
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

    if (result?.data?.trim()) {
      return result.data.trim();
    }
  }

  return null;
}

export default function PayScreen({ orderId }: { orderId: string }) {
  const [data, setData] = useState<OrderResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [navigatingToOrder, setNavigatingToOrder] = useState(false);
  const [bankPayUrl, setBankPayUrl] = useState<string | null>(null);
  const [resolvingBankUrl, setResolvingBankUrl] = useState(false);
  const search = useSearchParams();
  const router = useRouter();
  const clearCart = useCart((state) => state.clear);

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
        // Ignore transient network failures in polling.
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

        if (value && isLikelyUrl(value)) {
          setBankPayUrl(value);
        } else {
          setBankPayUrl(null);
        }
      } catch {
        if (!cancelled) {
          setBankPayUrl(null);
        }
      } finally {
        if (!cancelled) {
          setResolvingBankUrl(false);
        }
      }
    };

    void resolveQr();

    return () => {
      cancelled = true;
    };
  }, [data?.restaurant?.qrImageUrl]);

  const code = search.get("code") || data?.paymentCode || "";
  const menuHref = data?.restaurant?.slug ? `/r/${data.restaurant.slug}` : "/";

  function goToOrder() {
    setNavigatingToOrder(true);
    window.setTimeout(() => {
      router.push(`/order/${orderId}`);
    }, 160);
  }

  function goToBankPayment() {
    if (!bankPayUrl) {
      toast.error("Не удалось извлечь ссылку оплаты из QR");
      return;
    }

    window.location.assign(bankPayUrl);
  }

  async function markPaid() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/mark-paid`, { method: "POST" });
      const j = (await res.json()) as { error?: string };
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

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Код скопирован");
    } catch {
      toast.error("Не удалось скопировать");
    }
  }

  return (
    <main className="min-h-screen p-5 pb-36">
      <div className="max-w-md mx-auto">
        <div className="text-3xl font-extrabold">Оплата по QR</div>
        <div className="mt-1 text-sm text-black/60">{data?.restaurant?.name ?? ""}</div>

        <Card className="mt-4 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-black/60">Итого</div>
            <div className="text-xl font-extrabold">{formatKgs(data?.totalKgs ?? 0)}</div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-sm text-black/70">
            <div>
              Код оплаты: <span className="font-extrabold">{code}</span>
            </div>
            <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => void copyCode()}>
              Копировать
            </Button>
          </div>
          <div className="mt-1 text-[12px] text-black/45">Укажи этот код в комментарии к переводу.</div>

          <div className="relative mt-4 aspect-square w-full overflow-hidden rounded-2xl border border-black/10 bg-white">
            {data?.restaurant?.qrImageUrl ? (
              <Image src={data.restaurant.qrImageUrl} alt="QR" fill className="object-contain p-6" sizes="420px" />
            ) : (
              <div className="p-6 text-black/50">QR не настроен</div>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <Button onClick={() => void markPaid()} disabled={loading || navigatingToOrder} className="w-full">
              Я оплатил(а)
            </Button>
            <Button
              variant="secondary"
              onClick={goToBankPayment}
              disabled={navigatingToOrder || resolvingBankUrl || !bankPayUrl}
              className="w-full border-black/10 bg-white text-black"
            >
              <div className="flex items-center justify-center">
                <div className="relative h-10 w-48 overflow-hidden rounded-md bg-white">
                  <Image src="/mbank-logo.png" alt="Bank payment" fill className="object-contain" sizes="192px" />
                </div>
                <span className="sr-only">{resolvingBankUrl ? "Считываем ссылку из QR..." : "Оплатить через банк"}</span>
              </div>
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
