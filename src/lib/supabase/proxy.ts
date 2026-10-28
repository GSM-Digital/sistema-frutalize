import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseConfig } from "./config";
import { safeReturnPath } from "@/lib/inventory/validation";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) {
    if (
      request.nextUrl.pathname === "/" ||
      ["/dashboard", "/terminal", "/gestao", "/portal"].some((path) => request.nextUrl.pathname.startsWith(path))
    )
      return NextResponse.redirect(new URL("/login", request.url));
    return response;
  }
  const { url, key } = supabaseConfig();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const authenticated = Boolean(data?.claims);
  const path = request.nextUrl.pathname;

  const protectedPath = ["/dashboard", "/terminal", "/gestao", "/portal"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (!authenticated && (path === "/" || protectedPath)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (protectedPath) url.searchParams.set("retorno", safeReturnPath(path));
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  if (authenticated && (path === "/login" || path === "/")) {
    const { data: member } = await supabase.from("staff_members").select("role, active").eq("user_id", data!.claims!.sub).maybeSingle();
    const url = request.nextUrl.clone();
    const requested = request.nextUrl.searchParams.get("retorno");
    url.pathname = requested ? safeReturnPath(requested) : member?.active ? (member.role === "admin" ? "/dashboard" : "/terminal") : "/portal";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
