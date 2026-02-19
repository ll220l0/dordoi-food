import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
  hasAdminCredentials,
  validateAdminPassword
} from "@/lib/adminSession";

type LoginBody = {
  username?: string;
  password?: string;
};

export async function POST(req: Request) {
  if (!hasAdminCredentials()) {
    return NextResponse.json({ error: "Учетные данные администратора не настроены" }, { status: 500 });
  }

  const body = (await req.json().catch(() => null)) as LoginBody | null;
  const username = body?.username?.trim() ?? "";
  const password = body?.password ?? "";

  if (!validateAdminPassword(username, password)) {
    return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }

  const token = await createAdminSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Не удалось создать сессию администратора" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS
  });
  return res;
}
