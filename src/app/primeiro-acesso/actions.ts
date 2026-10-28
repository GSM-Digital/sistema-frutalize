"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function setPassword(form: FormData) {
  const client = await createClient();
  const { data } = await client.auth.getUser();
  if (!data.user) redirect("/login");
  const password = form.get("password");
  if (
    typeof password !== "string" ||
    password !== form.get("confirmation") ||
    password.length < 12 ||
    password.length > 128 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  )
    redirect("/primeiro-acesso?erro=Confira+as+senhas+e+os+requisitos.");
  const { error } = await client.auth.updateUser({ password });
  if (error)
    redirect(
      "/primeiro-acesso?erro=Não+foi+possível+definir+a+senha.+Solicite+um+novo+link.",
    );
  await client.auth.signOut();
  redirect("/login");
}
