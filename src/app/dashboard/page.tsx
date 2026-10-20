import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { logout } from "./actions";

export const instant = false;

const cards = [
  { label: "Itens cadastrados", value: "0", detail: "Catálogo inicial" },
  { label: "Lotes em estoque", value: "0", detail: "Nenhum lote registrado" },
  { label: "Em quarentena", value: "0", detail: "Aguardando liberação" },
  { label: "Próximos do vencimento", value: "0", detail: "Sem alertas" },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) redirect("/login");

  const email = typeof data.claims.email === "string" ? data.claims.email : "Administrador";

  return (
    <main className="min-h-screen bg-[#f5f7f2]">
      <header className="border-b border-[#dfe6dc] bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[#236b3c] font-bold text-white" aria-hidden="true">F</span>
            <div>
              <p className="font-semibold tracking-tight">Sistema Frutalize</p>
              <p className="text-xs text-[#788278]">Ambiente administrativo</p>
            </div>
          </div>
          <form action={logout}>
            <button className="rounded-lg border border-[#d5ddd2] bg-white px-3 py-2 text-sm font-semibold text-[#3e493e] transition hover:bg-[#f5f7f2]" type="submit">Sair</button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#236b3c]">Visão geral</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-[#172117]">Estoque</h1>
            <p className="mt-2 text-[#667166]">Estrutura inicial conectada. O próximo passo é cadastrar produtos e locais.</p>
          </div>
          <p className="text-sm text-[#788278]">Conectado como {email}</p>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores do estoque">
          {cards.map((card) => (
            <article key={card.label} className="rounded-2xl border border-[#dfe6dc] bg-white p-5 shadow-[0_8px_30px_rgba(31,48,31,0.04)]">
              <p className="text-sm font-medium text-[#667166]">{card.label}</p>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-[#172117]">{card.value}</p>
              <p className="mt-2 text-sm text-[#8a948a]">{card.detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded-2xl border border-[#dfe6dc] bg-white p-6 shadow-[0_8px_30px_rgba(31,48,31,0.04)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Movimentações recentes</h2>
                <p className="mt-1 text-sm text-[#788278]">Entradas, saídas e ajustes aparecerão aqui.</p>
              </div>
              <span className="rounded-full bg-[#e8f3e9] px-3 py-1 text-xs font-semibold text-[#236b3c]">Integrado</span>
            </div>
            <div className="mt-8 grid min-h-44 place-items-center rounded-xl border border-dashed border-[#cfdbcc] bg-[#f8faf7] px-6 text-center">
              <div>
                <p className="font-medium text-[#3f4d3f]">Nenhuma movimentação registrada</p>
                <p className="mt-2 text-sm leading-6 text-[#7b867b]">O histórico será criado automaticamente a partir do primeiro recebimento.</p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl bg-[#194d2e] p-6 text-white shadow-[0_16px_40px_rgba(25,77,46,0.18)]">
            <p className="text-sm font-semibold text-[#b9dabf]">Implantação</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Base do sistema pronta</h2>
            <ul className="mt-6 space-y-4 text-sm text-white/75">
              <li className="flex gap-3"><span className="text-[#9fd3a8]">✓</span> Aplicação Next.js</li>
              <li className="flex gap-3"><span className="text-[#9fd3a8]">✓</span> Autenticação Supabase</li>
              <li className="flex gap-3"><span className="text-[#9fd3a8]">✓</span> Publicação contínua pela Vercel</li>
              <li className="flex gap-3"><span className="text-[#9fd3a8]">✓</span> Interface responsiva</li>
            </ul>
          </article>
        </section>
      </div>
    </main>
  );
}
