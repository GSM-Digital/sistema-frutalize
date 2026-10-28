import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");
  const client = await createClient();
  const result = code
    ? await client.auth.exchangeCodeForSession(code)
    : tokenHash && (type === "invite" || type === "recovery")
      ? await client.auth.verifyOtp({ token_hash: tokenHash, type })
      : null;
  const target = new URL(
    result && !result.error
      ? "/primeiro-acesso"
      : "/login?erro=Link+inválido+ou+expirado.+Solicite+novo+convite.",
    url.origin,
  );
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
