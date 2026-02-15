"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartLine = { menuItemId: string; title: string; photoUrl: string; priceKgs: number; qty: number; };

type CartState = {
  restaurantSlug?: string;
  lines: CartLine[];
  setRestaurant: (slug: string) => void;
  setLines: (slug: string, lines: CartLine[]) => void;
  add: (line: Omit<CartLine, "qty">) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  clear: () => void;
  total: () => number;
  count: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      restaurantSlug: undefined,
      lines: [],
      setRestaurant: (slug) => set({ restaurantSlug: slug }),
      setLines: (slug, lines) => set({ restaurantSlug: slug, lines }),
      add: (line) => {
        const lines = get().lines;
        const existing = lines.find((x) => x.menuItemId === line.menuItemId);
        if (existing) return set({ lines: lines.map((x) => x.menuItemId === line.menuItemId ? { ...x, qty: x.qty + 1 } : x) });
        set({ lines: [...lines, { ...line, qty: 1 }] });
      },
      inc: (id) => set({ lines: get().lines.map((x) => (x.menuItemId === id ? { ...x, qty: x.qty + 1 } : x)) }),
      dec: (id) => set({ lines: get().lines.map((x) => (x.menuItemId === id ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0) }),
      clear: () => set({ lines: [], restaurantSlug: undefined }),
      total: () => get().lines.reduce((s, x) => s + x.priceKgs * x.qty, 0),
      count: () => get().lines.reduce((s, x) => s + x.qty, 0)
    }),
    { name: "dordoi_food_cart_v3" }
  )
);
