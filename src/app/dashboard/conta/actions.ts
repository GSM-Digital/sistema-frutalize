"use server";

import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";

export async function changePassword(form: FormData) {
  const access = await requireStaff();
  const current = form.get("current_password");
  const password = form.get("password");
  if (
    typeof current !== "string" ||
    !current ||
    typeof password !== "string" ||
    password !== form.get("confirmation") ||
    password.length < 12 ||
    password.length > 128 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  )
    redirect(
      "/dashboard/conta?erro=Confira+os+campos+e+os+requisitos+da+senha.",
    );

  const { error } = await access.supabase.auth.updateUser({
    current_password: current,
    password,
  });
  if (error)
    redirect(
      "/dashboard/conta?erro=Não+foi+possível+trocar+a+senha.+Confira+a+senha+atual+ou+entre+novamente.",
    );
  await access.supabase.auth.signOut();
  redirect("/login");
}

export async function resetAccountPassword() {
  const access = await requireStaff();
  const email = access.user.email;
  const base = process.env.APP_ORIGIN;
  if (!email || !base || !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base))
    redirect(
      "/dashboard/conta?erro=O+envio+por+e-mail+não+está+configurado.+Contate+o+administrador.",
    );
  const { error } = await access.supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/auth/confirm`,
  });
  if (error)
    redirect(
      "/dashboard/conta?erro=Não+foi+possível+enviar+o+e-mail+agora.+Tente+novamente+mais+tarde.",
    );
  redirect("/dashboard/conta?enviado=1");
}
