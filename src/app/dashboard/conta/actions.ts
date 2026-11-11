"use server";

import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";

const accountPath = "/dashboard/conta";
const accountError = (message: string) =>
  redirect(`${accountPath}?erro=${encodeURIComponent(message)}`);

export async function saveAccountProfile(form: FormData) {
  const { supabase, user } = await requireStaff();
  const name = String(form.get("display_name") ?? "").trim();
  const role = String(form.get("role") ?? "");
  if (
    name.length < 2 ||
    name.length > 120 ||
    !["admin", "manager", "collaborator"].includes(role)
  )
    accountError("Confira o nome e o perfil selecionado.");
  const { error } = await supabase.rpc("operations_command", {
    p_command_id: crypto.randomUUID(),
    p_module: "staff",
    p_action: "save",
    p_data: {
      user_id: user.id,
      display_name: name,
      role,
      reason: "Atualização dos dados da própria conta",
    },
  });
  if (error)
    accountError(
      error.message.includes("administrador ativo")
        ? "É necessário manter pelo menos um administrador ativo."
        : "Não foi possível salvar nome e perfil. Confira suas permissões.",
    );
  redirect(`${accountPath}?perfil=1`);
}

export async function saveAccountPhone(form: FormData) {
  const { supabase } = await requireStaff();
  const phone = String(form.get("phone") ?? "").trim();
  if (phone.length > 30 || !/^[+\d() .-]*$/.test(phone))
    accountError("Confira o telefone informado.");
  const { error } = await supabase.auth.updateUser({ data: { phone } });
  if (error) accountError("Não foi possível salvar o telefone.");
  redirect(`${accountPath}?telefone=1`);
}

export async function requestAccountEmailChange(form: FormData) {
  const { supabase, user } = await requireStaff();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    accountError("Informe um e-mail válido.");
  if (email === user.email?.toLowerCase())
    accountError("Esse já é o e-mail da conta.");
  const base = process.env.APP_ORIGIN;
  const options =
    base && /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base)
      ? { emailRedirectTo: `${base}/auth/email-confirm` }
      : undefined;
  const { error } = await supabase.auth.updateUser({ email }, options);
  if (error) accountError("Não foi possível solicitar a alteração do e-mail.");
  redirect(`${accountPath}?email=1`);
}

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
