"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui";

export function AdminLogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("Не удалось выйти");
      router.replace("/admin/login");
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" className={className} onClick={() => void logout()} disabled={loading}>
      {loading ? "Выходим..." : "Выйти"}
    </Button>
  );
}
