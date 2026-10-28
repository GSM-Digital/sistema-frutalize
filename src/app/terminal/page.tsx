import Link from "next/link";
import { connection } from "next/server";
import { getProductionAccess } from "@/lib/auth";
import { ProductionTerminal } from "@/components/production/terminal";
import { terminalSnapshot } from "@/lib/production/ui-types";
import { lockTerminal } from "./actions";

export const instant = false;

export default async function TerminalPage({
  searchParams,
}: {
  searchParams: Promise<{ ordem?: string }>;
}) {
  await connection();
  const access = await getProductionAccess();
  if (access.status !== "ready")
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-5">
        <section className="panel p-7">
          <p className="eyebrow">Terminal Frutalize</p>
          <h1 className="mt-3 text-2xl font-semibold">
            Acesso aguardando liberação
          </h1>
          <p className="muted mt-4">
            Solicite ao responsável um vínculo ativo para operar a produção.
          </p>
          <form action={lockTerminal} className="mt-6">
            <button className="btn btn-secondary">Voltar ao login</button>
          </form>
        </section>
      </main>
    );
  const { data, error } = await access.supabase.rpc(
    "production_terminal_snapshot",
  );
  if (error)
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-5">
        <section className="notice">
          <h1 className="text-xl font-semibold">Terminal indisponível</h1>
          <p className="mt-3">
            Não foi possível consultar as ordens. Peça ao responsável para
            verificar a conexão e a preparação do banco.
          </p>
          <Link href="/terminal" className="btn btn-secondary mt-5">
            Tentar novamente
          </Link>
        </section>
      </main>
    );
  const initial = terminalSnapshot(data);
  const { ordem } = await searchParams;
  return (
    <section className="production-terminal-route">
      <ProductionTerminal initial={initial} initialRunId={ordem} />
    </section>
  );
}
