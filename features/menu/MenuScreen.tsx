"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button, Card, Photo } from "@/components/ui";
import { ClientNav } from "@/components/ClientNav";
import { useCart } from "@/lib/cartStore";
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
  if (!res.ok) throw new Error("Не удалось загрузить меню");
  return res.json();
}

function QtyStepper({ qty, onInc, onDec }: { qty: number; onInc: () => void; onDec: () => void }) {
  const [isPopping, setIsPopping] = useState(false);

  useEffect(() => {
    setIsPopping(true);
    const timer = window.setTimeout(() => setIsPopping(false), 180);
    return () => window.clearTimeout(timer);
  }, [qty]);

  return (
    <div className="inline-flex items-center rounded-full border border-black/10 bg-white/95 p-1 shadow-[0_10px_24px_rgba(15,23,42,0.15)] backdrop-blur-sm">
      <button
        type="button"
        onClick={onDec}
        className="h-9 w-9 rounded-full border border-rose-200 bg-rose-50 text-lg font-bold leading-none text-rose-700 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(225,29,72,0.22)] active:translate-y-0 active:scale-95"
        aria-label="Уменьшить"
      >
        -
      </button>

      <div
        className={`min-w-[2.9rem] px-2 text-center text-base font-extrabold text-slate-900 transition-transform duration-200 ${
          isPopping ? "scale-110" : "scale-100"
        }`}
      >
        {qty}
      </div>

      <button
        type="button"
        onClick={onInc}
        className="h-9 w-9 rounded-full border border-orange-300 bg-gradient-to-br from-orange-500 to-amber-500 text-lg font-bold leading-none text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(249,115,22,0.35)] active:translate-y-0 active:scale-95"
        aria-label="Увеличить"
      >
        +
      </button>
    </div>
  );
}

function clamp2Style(): CSSProperties {
  return {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden"
  };
}

export default function MenuScreen({ slug }: { slug: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["menu", slug],
    queryFn: () => fetchMenu(slug),
    refetchInterval: 15000
  });

  const router = useRouter();
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const setRestaurant = useCart((state) => state.setRestaurant);
  const add = useCart((state) => state.add);
  const inc = useCart((state) => state.inc);
  const dec = useCart((state) => state.dec);
  const lines = useCart((state) => state.lines);

  const effectiveSlug = data?.restaurant?.slug ?? slug;

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
    return !activeCat ? data.items : data.items.filter((item) => item.categoryId === activeCat);
  }, [data, activeCat]);

  function addToCart(item: MenuResp["items"][number]) {
    add({ menuItemId: item.id, title: item.title, photoUrl: item.photoUrl, priceKgs: item.priceKgs });
  }

  return (
    <main className="min-h-screen px-4 pb-44 pt-5 sm:px-5">
      <div className="mx-auto max-w-md">
        <section className="sticky top-2 z-30 rounded-3xl border border-white/80 bg-white/70 p-3 shadow-[0_16px_38px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Меню</div>
          <div className="mt-1 text-[2.1rem] font-extrabold leading-none tracking-tight text-slate-900">{data?.restaurant?.name ?? "..."}</div>

          <div className="relative mt-3">
            <div className="menu-edge-fade-left" aria-hidden="true" />
            <div className="menu-edge-fade-right" aria-hidden="true" />
            <div className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 pr-1">
              {(data?.categories ?? []).map((category) => {
                const isActive = category.id === activeCat;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActiveCat(category.id)}
                    className={`shrink-0 snap-start rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                      isActive
                        ? "bg-black text-white shadow-[0_10px_24px_rgba(15,23,42,0.28)] ring-1 ring-white/20"
                        : "border border-white/85 bg-white/90 text-slate-600 hover:bg-white"
                    }`}
                  >
                    {category.title}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <div className="mt-4 space-y-3">
          {isLoading ? (
            <div className="px-2 text-sm text-slate-500">Загрузка...</div>
          ) : (
            items.map((item, index) => {
              const qty = qtyByItemId.get(item.id) ?? 0;
              const animationDelay = `${Math.min(index * 55, 330)}ms`;

              return (
                <Card
                  key={item.id}
                  className="motion-fade-up overflow-hidden p-3.5 transition-transform duration-300 hover:-translate-y-0.5 sm:p-4"
                  style={{ animationDelay }}
                >
                  <div className="flex gap-3.5">
                    <Photo src={item.photoUrl} alt={item.title} className="h-[84px] w-[84px] rounded-[22px]" sizes="84px" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 pr-1 text-lg font-bold leading-snug text-slate-900" style={clamp2Style()}>
                          {item.title}
                        </div>
                        <div className="shrink-0 rounded-full border border-amber-200/90 bg-amber-50 px-3 py-1 text-sm font-extrabold text-amber-900 shadow-[0_6px_16px_rgba(245,158,11,0.2)]">
                          {formatKgs(item.priceKgs)}
                        </div>
                      </div>

                      <div className="mt-1 text-sm leading-snug text-slate-500" style={clamp2Style()}>
                        {item.description}
                      </div>

                      <div className="mt-3 flex justify-end">
                        {!item.isAvailable ? (
                          <span className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-500">
                            Нет в наличии
                          </span>
                        ) : qty > 0 ? (
                          <QtyStepper qty={qty} onDec={() => dec(item.id)} onInc={() => inc(item.id)} />
                        ) : (
                          <Button
                            onClick={() => addToCart(item)}
                            className="h-10 rounded-full !bg-gradient-to-r !from-orange-500 !to-amber-500 px-5 text-base font-bold text-white shadow-[0_12px_26px_rgba(249,115,22,0.34)] hover:shadow-[0_16px_30px_rgba(245,158,11,0.36)]"
                            variant="primary"
                          >
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

          {!isLoading && items.length === 0 && (
            <Card className="p-4">
              <div className="text-sm text-slate-600">В этой категории сейчас нет доступных блюд.</div>
            </Card>
          )}
        </div>
      </div>

      <ClientNav menuHref={`/r/${effectiveSlug}`} />
    </main>
  );
}

