import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setPassword } from "./actions";
import { SubmitButton } from "@/components/submit-button";
export const instant = false;
export default async function FirstAccess({ searchParams }: { searchParams: Promise<{erro?:string}> }) {
  await connection();
  const client = await createClient();
  const { data } = await client.auth.getUser();
  if (!data.user) redirect("/login");
  const { erro } = await searchParams;
  return <main className="mx-auto flex min-h-screen max-w-lg items-center p-6"><section className="panel w-full p-7"><p className="eyebrow">Frutalize</p><h1 className="mt-2 text-2xl font-semibold">Defina sua senha</h1><p className="muted mt-3 text-sm">Use pelo menos 12 caracteres, com maiúscula, minúscula, número e símbolo.</p><form className="mt-6 space-y-4" action={setPassword}><label className="block text-sm">Nova senha<input className="mt-2 block w-full rounded-lg border p-3" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label><label className="block text-sm">Repita a senha<input className="mt-2 block w-full rounded-lg border p-3" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>{erro && <p role="alert" className="text-red-700">{erro.slice(0,200)}</p>}<SubmitButton>Salvar senha e entrar novamente</SubmitButton></form></section></main>;
}
