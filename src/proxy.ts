import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/terminal/:path*",
    "/gestao/:path*",
    "/portal/:path*",
    "/suporte/relatar",
    "/primeiro-acesso",
    "/auth/confirm",
  ],
};
