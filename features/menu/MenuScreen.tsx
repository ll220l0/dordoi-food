"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button, Card, Photo, Pill } from "@/components/ui";
import { ClientNav } from "@/components/ClientNav";
import { useCart } from "@/lib/cartStore";
import { getLastOrderId, getPendingPayOrderId } from "@/lib/clientPrefs";
import { formatKgs } from "@/lib/money";

type MenuResp = {
  restaurant: { id: string; name: string; slug: string };
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
  const res = await fetch(`/api/restaurants/${slug}/menu`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load menu");
  return res.json();
}

export default function MenuScreen({ slug }: { slug: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["menu", slug],
    queryFn: () => fetchMenu(slug),
    refetchInterval: 5000
  });

  const router = useRouter();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [orderHref, setOrderHref] = useState<string | null>(null);

  const setRestaurant = useCart((state) => state.setRestaurant);
  const add = useCart((state) => state.add);
  const inc = useCart((state) => state.inc);
  const dec = useCart((state) => state.dec);
  const lines = useCart((state) => state.lines);

  const effectiveSlug = data?.restaurant?.slug ?? slug;

  useEffect(() => {
    const pendingPayOrderId = getPendingPayOrderId();
    const lastOrderId = getLastOrderId();
    setOrderHref(pendingPayOrderId ? `/pay/${pendingPayOrderId}` : lastOrderId ? `/order/${lastOrderId}` : null);
  }, []);

  useEffect(() => {
    setRestaurant(effectiveSlug);
  }, [effectiveSlug, setRestaurant]);

  useEffect(() => {
    if (data?.restaurant?.slug && data.restaurant.slug !== slug) {
      router.replace(`/r/${data.restaurant.slug}`);
    }
  }, [data?.restaurant?.slug, slug, router]);

  useEffect(() => {
    if (data?.categories?.length && !activeCat) setActiveCat(data.categories[0].id);
  }, [data?.categories, activeCat]);

  const qtyByItemId = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of lines) map.set(line.menuItemId, line.qty);
    return map;
  }, [lines]);

  const items = useMemo(() => {
    if (!data) return [];
    if (!activeCat) return data.items;
    return data.items.filter((x) => x.categoryId === activeCat);
  }, [data, activeCat]);

  function addToCart(item: MenuResp["items"][number]) {
    add({ menuItemId: item.id, title: item.title, photoUrl: item.photoUrl, priceKgs: item.priceKgs });
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
            items.map((m) => {
              const qty = qtyByItemId.get(m.id) ?? 0;
              return (
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
                        {!m.isAvailable ? (
                          <Button disabled variant="secondary" className="px-4 py-2">
                            Нет в наличии
                          </Button>
                        ) : qty > 0 ? (
                          <div className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-2 py-1">
                            <Button variant="secondary" className="px-3 py-1" onClick={() => dec(m.id)}>
                              -1
                            </Button>
                            <span className="min-w-8 text-center text-sm font-semibold">{qty}</span>
                            <Button className="px-3 py-1" onClick={() => inc(m.id)}>
                              +1
                            </Button>
                          </div>
                        ) : (
                          <Button onClick={() => addToCart(m)} className="px-4 py-2" variant="primary">
                            + Добавить
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <ClientNav menuHref={`/r/${effectiveSlug}`} orderHref={orderHref} />
    </main>
  );
}
