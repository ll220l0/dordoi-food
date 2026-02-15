"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button, Card, Photo, Pill } from "@/components/ui";
import { ClientNav } from "@/components/ClientNav";
import { useCart } from "@/lib/cartStore";
import { getLastOrderId } from "@/lib/clientPrefs";
import { formatKgs } from "@/lib/money";

type MenuResp = {
  restaurant: { id: string; name: string; slug: string; qrImageUrl: string };
  categories: { id: string; title: string; sortOrder: number }[];
  items: {
    id: string;
    categoryId: string;
    title: string;
    description: string;
    photoUrl: string;
    priceKgs: number;
    isAvailable: boolean;
  }[];
};

async function fetchMenu(slug: string): Promise<MenuResp> {
  const res = await fetch(`/api/restaurants/${slug}/menu`);
  if (!res.ok) throw new Error("Failed to load menu");
  return res.json();
}

export default function MenuScreen({ slug }: { slug: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["menu", slug], queryFn: () => fetchMenu(slug) });
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const setRestaurant = useCart((state) => state.setRestaurant);
  const add = useCart((state) => state.add);
  const total = useCart((state) => state.total());
  const count = useCart((state) => state.count());

  useEffect(() => {
    setIsHydrated(true);
    setLastOrderId(getLastOrderId());
  }, []);

  useEffect(() => {
    setRestaurant(slug);
  }, [slug, setRestaurant]);

  useEffect(() => {
    if (data?.categories?.length && !activeCat) setActiveCat(data.categories[0].id);
  }, [data?.categories, activeCat]);

  const items = useMemo(() => {
    if (!data) return [];
    if (!activeCat) return data.items;
    return data.items.filter((x) => x.categoryId === activeCat);
  }, [data, activeCat]);

  function addToCart(item: MenuResp["items"][number]) {
    add({ menuItemId: item.id, title: item.title, photoUrl: item.photoUrl, priceKgs: item.priceKgs });
    toast.success("Добавлено в корзину");
  }

  return (
    <main className="min-h-screen p-5 pb-44">
      <div className="mx-auto max-w-md">
        <div>
          <div className="text-xs text-black/50">Меню</div>
          <div className="text-3xl font-extrabold tracking-tight">{data?.restaurant?.name ?? "..."}</div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {(data?.categories ?? []).map((c) => (
            <button key={c.id} onClick={() => setActiveCat(c.id)} className="shrink-0">
              <Pill active={c.id === activeCat}>{c.title}</Pill>
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-3">
          {isLoading ? (
            <div className="text-sm text-black/50">Загрузка...</div>
          ) : (
            items.map((m) => (
              <Card key={m.id} className="p-3">
                <div className="flex gap-3">
                  <Photo src={m.photoUrl} alt={m.title} />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold">{m.title}</div>
                      <div className="font-bold">{formatKgs(m.priceKgs)}</div>
                    </div>
                    <div className="mt-1 text-sm text-black/55">{m.description}</div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        disabled={!m.isAvailable}
                        onClick={() => addToCart(m)}
                        className="px-4 py-2"
                        variant={m.isAvailable ? "primary" : "secondary"}
                      >
                        {m.isAvailable ? "+ Добавить" : "Нет в наличии"}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {isHydrated && count > 0 && (
          <div className="fixed left-0 right-0 bottom-24 z-30 px-4">
            <div className="mx-auto max-w-md">
              <Link
                href="/cart"
                className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/85 px-4 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur-xl"
              >
                <div className="font-semibold">Корзина</div>
                <div className="text-sm text-black/60">{count} шт</div>
                <div className="font-extrabold">{formatKgs(total)}</div>
              </Link>
            </div>
          </div>
        )}
      </div>

      <ClientNav menuHref={`/r/${slug}`} orderHref={lastOrderId ? `/order/${lastOrderId}` : null} />
    </main>
  );
}
