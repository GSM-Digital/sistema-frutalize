"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeReturnPath } from "@/lib/inventory/validation";
import { verifyTurnstile } from "@/lib/turnstile";

export async function login(formData: FormData) {
  if (!isSupabaseConfigured())
    redirect("/login?erro=O+acesso+ainda+não+foi+configurado.");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?erro=Informe+o+e-mail+e+a+senha.");
  }

  const retorno = safeReturnPath(formData.get("retorno"));
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response"))))
    redirect(
      `/login?${new URLSearchParams({ erro: "Não foi possível validar a verificação de segurança. Tente novamente.", retorno })}`,
    );
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(
      `/login?${new URLSearchParams({ erro: "Não foi possível entrar. Confira suas credenciais e tente novamente.", retorno })}`,
    );
  }

  const { data: user } = await supabase.auth.getUser();
  const { data: member } = await supabase.from("staff_members").select("role, active").eq("user_id", user.user!.id).maybeSingle();
  if (member && !member.active) {
    await supabase.auth.signOut();
    redirect("/login?erro=Acesso+bloqueado.+Contate+o+administrador.");
  }
  redirect(retorno === "/dashboard" && member?.role !== "admin" ? (member?.active ? "/terminal" : "/portal") : retorno);
}
