"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Button, Card } from "@/components/ui";

function resolveNextPath(raw: string | null) {
  if (!raw) return "/admin";
  if (!raw.startsWith("/")) return "/admin";
  if (raw.startsWith("//")) return "/admin";
  if (raw.startsWith("/api/")) return "/admin";
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nextPath = useMemo(() => resolveNextPath(search.get("next")), [search]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("Введите логин и пароль");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(j?.error ?? "Не удалось войти");

      router.replace(nextPath);
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-5">
      <div className="mx-auto max-w-md">
        <div className="text-3xl font-extrabold">Вход в админку</div>
        <div className="mt-1 text-sm text-black/60">Авторизуйся для доступа к заказам и меню.</div>

        <Card className="mt-4 p-4">
          <form className="space-y-3" onSubmit={(e) => void submit(e)}>
            <input
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-3"
              placeholder="Логин"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-3"
              placeholder="Пароль"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Входим..." : "Войти"}
            </Button>
          </form>
        </Card>

        <div className="mt-3 text-center text-sm text-black/55">
          <Link className="underline" href="/">
            На главную
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen p-5" />}>
      <LoginForm />
    </Suspense>
  );
}
