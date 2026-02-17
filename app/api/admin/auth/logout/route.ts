import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminSession";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0
  });
  return res;
}
