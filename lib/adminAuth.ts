import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { AdminRole, AdminSessionIdentity } from "@/lib/adminSession";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/adminSession";

export async function getAdminSession(): Promise<AdminSessionIdentity | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value ?? "";
  if (!token) return null;
  return verifyAdminSessionToken(token);
}

export async function requireAdminRole(allowed: AdminRole[]) {
  const session = await getAdminSession();
  if (!session) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!allowed.includes(session.role)) {
    return { response: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }) };
  }

  return { session };
}

