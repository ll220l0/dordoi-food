export type SavedOrderLine = {
  menuItemId: string;
  title: string;
  photoUrl: string;
  priceKgs: number;
  qty: number;
};

export type OrderHistoryEntry = {
  orderId: string;
  restaurantSlug: string;
  customerPhone: string;
  totalKgs: number;
  createdAt: string;
  lines: SavedOrderLine[];
};

const PHONE_COOKIE = "dordoi_phone";
const HISTORY_COOKIE = "dordoi_order_history";
const PENDING_PAY_ORDER_KEY = "dordoi_pending_pay_order_id";
const COOKIE_DAYS = 120;
const HISTORY_LIMIT = 8;

function isBrowser() {
  return typeof document !== "undefined";
}

function getCookie(name: string) {
  if (!isBrowser()) return "";
  const entry = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : "";
}

function setCookie(name: string, value: string, days = COOKIE_DAYS) {
  if (!isBrowser()) return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function safeParse<T>(value: string, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function getSavedPhone() {
  return getCookie(PHONE_COOKIE);
}

export function setSavedPhone(phone: string) {
  setCookie(PHONE_COOKIE, phone);
}

export function getOrderHistory() {
  return safeParse<OrderHistoryEntry[]>(getCookie(HISTORY_COOKIE), []);
}

export function addOrderToHistory(entry: OrderHistoryEntry) {
  const next = [entry, ...getOrderHistory()]
    .filter((item, index, arr) => arr.findIndex((x) => x.orderId === item.orderId) === index)
    .slice(0, HISTORY_LIMIT);
  setCookie(HISTORY_COOKIE, JSON.stringify(next));
}

export function getLastOrderId() {
  return getOrderHistory()[0]?.orderId ?? null;
}

export function getPendingPayOrderId() {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(PENDING_PAY_ORDER_KEY);
  return value?.trim() ? value : null;
}

export function setPendingPayOrderId(orderId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_PAY_ORDER_KEY, orderId);
}

export function clearPendingPayOrderId(orderId?: string) {
  if (typeof window === "undefined") return;
  if (!orderId) {
    window.localStorage.removeItem(PENDING_PAY_ORDER_KEY);
    return;
  }

  const current = window.localStorage.getItem(PENDING_PAY_ORDER_KEY);
  if (current === orderId) {
    window.localStorage.removeItem(PENDING_PAY_ORDER_KEY);
  }
}

export function getFrequentMenuItems(restaurantSlug: string) {
  const counters = new Map<string, number>();

  for (const order of getOrderHistory()) {
    if (order.restaurantSlug !== restaurantSlug) continue;
    for (const line of order.lines) {
      counters.set(line.menuItemId, (counters.get(line.menuItemId) ?? 0) + line.qty);
    }
  }

  return [...counters.entries()]
    .map(([menuItemId, qty]) => ({ menuItemId, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 4);
}
