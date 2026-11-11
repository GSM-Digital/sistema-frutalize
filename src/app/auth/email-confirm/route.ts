import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const client = await createClient();
  const result = code
    ? await client.auth.exchangeCodeForSession(code)
    : tokenHash && (type === "email_change" || type === "email")
      ? await client.auth.verifyOtp({ token_hash: tokenHash, type })
      : null;
  const target = new URL(
    result && !result.error
      ? "/dashboard/conta?email_confirmado=1"
      : "/dashboard/conta?erro=Link+de+confirmação+inválido+ou+expirado.",
    url.origin,
  );
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
