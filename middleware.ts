import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/adminSession";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  if (!isAdminPage && !isAdminApi) return NextResponse.next();

  if (pathname === "/admin/login" || pathname.startsWith("/api/admin/auth/")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? "";
  const isValidSession = token ? await verifyAdminSessionToken(token) : false;
  if (isValidSession) return NextResponse.next();

  if (isAdminApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);

}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
