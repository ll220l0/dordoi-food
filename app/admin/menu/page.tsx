"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button, Card, Photo } from "@/components/ui";
import { formatKgs } from "@/lib/money";

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  qrImageUrl: string;
  mbankNumber: string;
  obankNumber: string;
  bakaiNumber: string;
};
type Category = { id: string; title: string; sortOrder: number };
type Item = {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  photoUrl: string;
  priceKgs: number;
  isAvailable: boolean;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ошибка";
}

async function resizeImage(file: File) {
  const url = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Не удалось обработать изображение"));
      image.src = url;
    });

    const target = 900;
    const canvas = document.createElement("canvas");
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available");

    const minSide = Math.min(img.width, img.height);
    const sx = (img.width - minSide) / 2;
    const sy = (img.height - minSide) / 2;
    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, target, target);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Не удалось сжать изображение"))), "image/webp", 0.9);
    });

    return new File([blob], `${Date.now()}.webp`, { type: "image/webp" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function AdminMenuPage() {
  const [restaurantSlug, setRestaurantSlug] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [catTitle, setCatTitle] = useState("");
  const [itemId, setItemId] = useState<string | null>(null);
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemPhoto, setItemPhoto] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemAvail, setItemAvail] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [qrPassword, setQrPassword] = useState("");
  const [uploadingQr, setUploadingQr] = useState(false);
  const [savingQr, setSavingQr] = useState(false);
  const [mbankNumber, setMbankNumber] = useState("");
  const [obankNumber, setObankNumber] = useState("");
  const [bakaiNumber, setBakaiNumber] = useState("");
  const [bankPassword, setBankPassword] = useState("");
  const [savingBankNumbers, setSavingBankNumbers] = useState(false);

  const loadRestaurants = useCallback(async () => {
    const res = await fetch("/api/admin/restaurants", { cache: "no-store" });
    const j = (await res.json()) as { restaurants?: Restaurant[] };
    const first = j.restaurants?.[0];
    if (first) {
      setRestaurantSlug((current) => current || first.slug);
      setQrImageUrl(first.qrImageUrl ?? "");
      setMbankNumber(first.mbankNumber ?? "");
      setObankNumber(first.obankNumber ?? "");
      setBakaiNumber(first.bakaiNumber ?? "");
    }
  }, []);

  const loadMenu = useCallback(async (slug: string) => {
    const res = await fetch(`/api/admin/menu?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    const j = (await res.json()) as { categories?: Category[]; items?: Item[] };
    const nextCategories = j.categories ?? [];
    setCategories(nextCategories);
    setItems(j.items ?? []);
    setItemCategoryId((current) => current || nextCategories[0]?.id || "");
  }, []);

  useEffect(() => {
    void loadRestaurants();
  }, [loadRestaurants]);

  useEffect(() => {
    if (!restaurantSlug) return;
    void loadMenu(restaurantSlug);
  }, [restaurantSlug, loadMenu]);

  const groupedItems = useMemo(
    () =>
      categories.map((category) => ({
        category,
        items: items.filter((item) => item.categoryId === category.id)
      })),
    [categories, items]
  );

  function resetItemForm() {
    setItemId(null);
    setItemTitle("");
    setItemDesc("");
    setItemPhoto("");
    setItemPrice("");
    setItemAvail(true);
    setItemCategoryId(categories[0]?.id ?? "");
  }

  async function uploadPhoto(file: File) {
    setUploadingPhoto(true);
    try {
      const resized = await resizeImage(file);
      const formData = new FormData();
      formData.append("file", resized);

      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) throw new Error(j.error ?? "Не удалось загрузить фото");

      setItemPhoto(j.url);
      toast.success("Фото загружено");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function uploadQr(file: File) {
    setUploadingQr(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) throw new Error(j.error ?? "Не удалось загрузить QR");

      setQrImageUrl(j.url);
      toast.success("QR загружен");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploadingQr(false);
    }
  }

  async function saveQr() {
    if (!restaurantSlug || !qrImageUrl || !qrPassword.trim()) {
      toast.error("Введите пароль для смены QR");
      return;
    }
    setSavingQr(true);
    try {
      const res = await fetch("/api/admin/restaurants", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: restaurantSlug, qrImageUrl, qrPassword: qrPassword.trim() })
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Не удалось сохранить QR");
      toast.success("QR обновлен");
      setQrPassword("");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingQr(false);
    }
  }

  async function saveBankNumbers() {
    if (!restaurantSlug || !bankPassword.trim()) {
      toast.error("Введите пароль для смены номеров банков");
      return;
    }

    setSavingBankNumbers(true);
    try {
      const res = await fetch("/api/admin/restaurants", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: restaurantSlug,
          mbankNumber,
          obankNumber,
          bakaiNumber,
          bankPassword: bankPassword.trim()
        })
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Не удалось сохранить номера банков");

      toast.success("Номера банков обновлены");
      setBankPassword("");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingBankNumbers(false);
    }
  }

  async function createCategory() {
    if (!catTitle.trim()) return;
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          restaurantSlug,
          title: catTitle.trim(),
          sortOrder: categories.length + 1
        })
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Ошибка");
      toast.success("Категория создана");
      setCatTitle("");
      await loadMenu(restaurantSlug);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm("Удалить категорию вместе с блюдами?")) return;
    const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) toast.error(j.error ?? "Ошибка");
    else toast.success("Удалено");
    await loadMenu(restaurantSlug);
  }

  async function upsertItem() {
    if (!itemCategoryId) {
      toast.error("Выбери категорию");
      return;
    }
    if (!itemPrice.trim()) {
      toast.error("Укажите цену");
      return;
    }

    try {
      const payload = {
        id: itemId ?? undefined,
        restaurantSlug,
        categoryId: itemCategoryId,
        title: itemTitle.trim(),
        description: itemDesc.trim(),
        photoUrl: itemPhoto,
        priceKgs: Number(itemPrice),
        isAvailable: Boolean(itemAvail)
      };

      const res = await fetch("/api/admin/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Ошибка");

      toast.success(itemId ? "Блюдо обновлено" : "Блюдо создано");
      resetItemForm();
      await loadMenu(restaurantSlug);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  }

  async function toggleAvailability(id: string, isAvailable: boolean) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, isAvailable } : item)));

    const res = await fetch(`/api/admin/items/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isAvailable })
    });

    if (!res.ok) {
      setItems((current) => current.map((item) => (item.id === id ? { ...item, isAvailable: !isAvailable } : item)));
      toast.error("Не удалось обновить наличие");
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Удалить блюдо?")) return;
    const res = await fetch(`/api/admin/items/${id}`, { method: "DELETE" });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) toast.error(j.error ?? "Ошибка");
    else toast.success("Удалено");
    await loadMenu(restaurantSlug);
  }

  function editItem(item: Item) {
    setItemId(item.id);
    setItemCategoryId(item.categoryId);
    setItemTitle(item.title);
    setItemDesc(item.description ?? "");
    setItemPhoto(item.photoUrl);
    setItemPrice(String(item.priceKgs));
    setItemAvail(item.isAvailable);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="min-h-screen p-5">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-black/50">Admin</div>
            <div className="text-3xl font-extrabold">Редактор меню</div>
          </div>
          <Link className="text-sm text-black/60 underline" href="/admin">
            Назад
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="p-4">
              <div className="text-sm font-semibold">QR для оплаты</div>
              <div className="mt-2 text-xs text-black/55">Загрузи новый QR, чтобы обновить ссылку кнопки банка у клиента.</div>
              <label className="mt-3 flex cursor-pointer items-center justify-center rounded-2xl border border-white/80 bg-gradient-to-b from-white to-slate-50 p-3 text-sm shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:shadow-[0_14px_28px_rgba(15,23,42,0.14)]">
                <span className="inline-flex items-center rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">+ QR</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadQr(file);
                  }}
                />
              </label>

              {qrImageUrl && (
                <div className="relative mt-3 h-44 overflow-hidden rounded-2xl border border-black/10 bg-black/5">
                  <Image src={qrImageUrl} alt="QR preview" fill className="object-contain p-3" sizes="360px" />
                </div>
              )}

              <input
                className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-3"
                type="password"
                placeholder="Пароль для смены QR"
                value={qrPassword}
                onChange={(e) => setQrPassword(e.target.value)}
              />

              <Button
                className="mt-3 w-full"
                disabled={!restaurantSlug || !qrImageUrl || !qrPassword.trim() || uploadingQr || savingQr}
                onClick={() => void saveQr()}
              >
                {uploadingQr ? "Загружаем QR..." : savingQr ? "Сохраняем..." : "Сохранить QR"}
              </Button>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-semibold">Номера банков</div>
              <div className="mt-2 text-xs text-black/55">Укажи номера для Mbank, O bank и Bakai Bank. Сохранение защищено паролем.</div>

              <input
                className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-3"
                type="text"
                placeholder="Mbank номер"
                value={mbankNumber}
                onChange={(e) => setMbankNumber(e.target.value)}
              />
              <input
                className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-3"
                type="text"
                placeholder="O bank номер"
                value={obankNumber}
                onChange={(e) => setObankNumber(e.target.value)}
              />
              <input
                className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-3"
                type="text"
                placeholder="Bakai Bank номер"
                value={bakaiNumber}
                onChange={(e) => setBakaiNumber(e.target.value)}
              />

              <input
                className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-3"
                type="password"
                placeholder="Пароль для смены номеров"
                value={bankPassword}
                onChange={(e) => setBankPassword(e.target.value)}
              />

              <Button className="mt-3 w-full" disabled={!restaurantSlug || !bankPassword.trim() || savingBankNumbers} onClick={() => void saveBankNumbers()}>
                {savingBankNumbers ? "Сохраняем..." : "Сохранить номера банков"}
              </Button>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-semibold">Категории</div>
              <div className="mt-2 space-y-2">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                    <span>{category.title}</span>
                    <button className="text-red-600 underline" onClick={() => void deleteCategory(category.id)}>
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
              <input
                className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-3"
                placeholder="Новая категория"
                value={catTitle}
                onChange={(e) => setCatTitle(e.target.value)}
              />
              <Button className="mt-2 w-full" onClick={() => void createCategory()} disabled={!catTitle.trim() || !restaurantSlug}>
                Создать категорию
              </Button>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{itemId ? "Редактирование блюда" : "Новое блюдо"}</div>
                {itemId && (
                  <button className="text-sm underline text-black/60" onClick={resetItemForm}>
                    Сброс
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-2">
                <select
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-3"
                  value={itemCategoryId}
                  onChange={(e) => setItemCategoryId(e.target.value)}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.title}
                    </option>
                  ))}
                </select>
                <input
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-3"
                  placeholder="Название блюда"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                />
                <input
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-3"
                  placeholder="Описание"
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                />
                <input
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-3"
                  type="text"
                  inputMode="numeric"
                  placeholder="цена"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value.replace(/[^\d]/g, ""))}
                />
                <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-white/80 bg-gradient-to-b from-white to-slate-50 p-3 text-sm shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:shadow-[0_14px_28px_rgba(15,23,42,0.14)]">
                  <span className="inline-flex items-center rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">+ Фото</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadPhoto(file);
                    }}
                  />
                </label>

                {itemPhoto && (
                  <div className="relative mt-2 h-40 overflow-hidden rounded-2xl border border-black/10 bg-black/5">
                    <Image src={itemPhoto} alt="Preview" fill className="object-cover" sizes="360px" />
                  </div>
                )}

                <Button
                  className="w-full"
                  disabled={!restaurantSlug || !itemCategoryId || !itemTitle.trim() || !itemPhoto || !itemPrice.trim() || uploadingPhoto}
                  onClick={() => void upsertItem()}
                >
                  {uploadingPhoto ? "Загружаем фото..." : itemId ? "Сохранить блюдо" : "Создать блюдо"}
                </Button>
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="text-sm text-black/50">Превью клиентского меню</div>
            <div className="mt-3 space-y-6">
              {groupedItems.map(({ category, items: categoryItems }) => (
                <section key={category.id}>
                  <div className="text-xl font-bold">{category.title}</div>
                  <div className="mt-3 space-y-3">
                    {categoryItems.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-black/10 bg-white p-3">
                        <div className="flex gap-3">
                          <Photo src={item.photoUrl} alt={item.title} />
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold">{item.title}</div>
                                <div className="text-sm text-black/55">{item.description}</div>
                              </div>
                              <div className="font-bold">{formatKgs(item.priceKgs)}</div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                              <label className="inline-flex items-center gap-2 text-sm">
                                <span className="text-black/60">Наличие</span>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={item.isAvailable}
                                  onClick={() => void toggleAvailability(item.id, !item.isAvailable)}
                                  className={`relative h-7 w-12 rounded-full transition ${item.isAvailable ? "bg-emerald-500" : "bg-slate-300"}`}
                                >
                                  <span
                                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${
                                      item.isAvailable ? "left-[1.35rem]" : "left-0.5"
                                    }`}
                                  />
                                </button>
                                <span className={item.isAvailable ? "text-emerald-700" : "text-rose-700"}>
                                  {item.isAvailable ? "В наличии" : "Нет в наличии"}
                                </span>
                              </label>

                              <div className="flex gap-3 text-sm">
                                <button className="underline text-black/70" onClick={() => editItem(item)}>
                                  Редактировать
                                </button>
                                <button className="underline text-red-600" onClick={() => void deleteItem(item.id)}>
                                  Удалить
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {categoryItems.length === 0 && <div className="text-sm text-black/50">В этой категории пока нет блюд.</div>}
                  </div>
                </section>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}


