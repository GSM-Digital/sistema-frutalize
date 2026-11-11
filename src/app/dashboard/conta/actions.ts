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
