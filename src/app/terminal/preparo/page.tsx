import Link from "next/link";
import { connection } from "next/server";
import { getProductionAccess } from "@/lib/auth";
import { PreparationTerminal } from "@/components/production/preparation-terminal";
import type { PreparationSnapshot } from "@/lib/preparation/types";
import "@/app/preparation-styles.css";

export const instant = false;

export default async function PreparationPage() {
  await connection();
  const access = await getProductionAccess();
  if (access.status !== "ready")
    return (
      <main className="prep-unavailable">
        <h1>Acesso não liberado</h1>
        <p>Entre com uma conta ativa da equipe para usar o preparo.</p>
        <Link href="/login?retorno=%2Fterminal%2Fpreparo">Entrar</Link>
      </main>
    );
  const { data, error } = await access.supabase.rpc("preparation_snapshot");
  if (error || !data || typeof data !== "object" || Array.isArray(data))
    return (
      <main className="prep-unavailable">
        <h1>Preparo indisponível</h1>
        <p>Verifique a conexão e a atualização do banco de dados.</p>
        <Link href="/terminal/preparo">Tentar novamente</Link>
      </main>
    );
  return (
    <PreparationTerminal initial={data as unknown as PreparationSnapshot} />
  );
}
