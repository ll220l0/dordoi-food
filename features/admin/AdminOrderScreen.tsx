"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { Button, Card, Photo } from "@/components/ui";
import { formatKgs } from "@/lib/money";
import { getOrderStatusMeta } from "@/lib/orderStatus";
import { buildWhatsAppLink } from "@/lib/whatsapp";

type OrderItem = {
  id: string;
  title: string;
  qty: number;
  priceKgs: number;
  photoUrl: string;
};

type AdminOrderData = {
  id: string;
  status: string;
  totalKgs: number;
  paymentMethod: string;
  payerName: string;
  customerPhone: string;
  comment: string;
  location: { line?: string; container?: string; landmark?: string };
  createdAt: string;
  updatedAt: string;
  restaurant: { name: string; slug: string };
  items: OrderItem[];
};

function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, "");
}

export default function AdminOrderScreen({ orderId }: { orderId: string }) {
  const [data, setData] = useState<AdminOrderData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/orders/${orderId}`, { cache: "no-store" });
    if (!res.ok) {
      const errorPayload = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(errorPayload?.error ?? "Failed to load order");
    }

    const payload = (await res.json().catch(() => null)) as AdminOrderData | null;
    if (!payload) throw new Error("Failed to load order");
    setData(payload);
  }, [orderId]);

  useEffect(() => {
    void load().catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    });
  }, [load]);

  async function confirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/confirm`, { method: "POST" });
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(j?.error ?? "Failed");
      toast.success("Оплата подтверждена");
      void load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function deliver() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/deliver`, { method: "POST" });
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(j?.error ?? "Failed");
      toast.success("Заказ отмечен как доставленный");
      void load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  const statusMeta = useMemo(() => getOrderStatusMeta(data?.status ?? ""), [data?.status]);
  const whatsappHref = data?.customerPhone
    ? buildWhatsAppLink(
        normalizePhone(data.customerPhone),
        `Здравствуйте! По заказу ${data.id}: статус "${statusMeta.label}". Спасибо за выбор Dordoi Food!`
      )
    : null;

  return (
    <main className="min-h-screen p-5">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-black/50">Admin</div>
            <div className="text-3xl font-extrabold">Заказ #{orderId.slice(-6)}</div>
          </div>
          <div className="flex items-center gap-2">
            <Link className="text-sm text-black/60 underline" href="/admin/orders">
              Назад к заказам
            </Link>
            <AdminLogoutButton className="px-3 py-2 text-sm" />
          </div>
        </div>

        <Card className="mt-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">{data?.restaurant?.name ?? "..."}</div>
            <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${statusMeta.badgeClassName}`}>{statusMeta.label}</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="text-black/60">Сумма</div>
            <div className="text-right font-bold">{formatKgs(data?.totalKgs ?? 0)}</div>
            <div className="text-black/60">Метод оплаты</div>
            <div className="text-right">{data?.paymentMethod ?? "-"}</div>
            <div className="text-black/60">Плательщик</div>
            <div className="text-right">{data?.payerName || "-"}</div>
            <div className="text-black/60">Телефон</div>
            <div className="text-right">{data?.customerPhone || "-"}</div>
            <div className="text-black/60">Создан</div>
            <div className="text-right">{data ? new Date(data.createdAt).toLocaleString() : "-"}</div>
            <div className="text-black/60">Обновлен</div>
            <div className="text-right">{data ? new Date(data.updatedAt).toLocaleString() : "-"}</div>
          </div>

          <div className="mt-3 text-sm text-black/70">
            Проход <b>{data?.location?.line || "-"}</b>, контейнер <b>{data?.location?.container || "-"}</b>
            {data?.location?.landmark ? <> ({data.location.landmark})</> : null}
          </div>
          {data?.comment ? <div className="mt-1 text-sm text-black/70">Комментарий: {data.comment}</div> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {(data?.status === "created" || data?.status === "pending_confirmation") && (
              <Button disabled={loading} onClick={() => void confirm()}>
                Подтвердить оплату
              </Button>
            )}
            {data?.status !== "delivered" && data?.status !== "canceled" && (
              <Button disabled={loading} onClick={() => void deliver()} variant="secondary">
                Подтвердить доставку
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
        </Card>

        <div className="mt-4 space-y-3">
          {(data?.items ?? []).map((item) => (
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
      </div>
    </main>
  );
}
