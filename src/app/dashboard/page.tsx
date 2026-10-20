import Link from "next/link";
import { getAccess } from "@/lib/auth";
import { businessDate } from "@/lib/inventory/validation";
import {
  DataNotice,
  EmptyState,
  MovementsTable,
  PageHeading,
  Panel,
} from "@/components/inventory/ui";
export const instant = false;
export default async function DashboardPage() {
  const access = await getAccess();
  if (access.status !== "ready") return null;
  const [overview, recent] = await Promise.all([
    access.supabase.rpc("inventory_overview"),
    access.supabase
      .from("inventory_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id")
      .limit(6),
  ]);
  if (overview.error || recent.error || !overview.data?.[0])
    return <DataNotice />;
  const stats = overview.data[0];
  const today = businessDate();
  const cards = [
    {
      label: "Produtos ativos",
      value: stats.products_count,
      detail: "Catálogo da fábrica",
      href: "/dashboard/cadastros/produtos",
      icon: "◇",
    },
    {
      label: "Lotes com saldo",
      value: stats.lots_count,
      detail: "Em todos os locais",
      href: "/dashboard/lotes",
      icon: "▦",
    },
    {
      label: "Em quarentena",
      value: stats.quarantine_count,
      detail: "Aguardando conferência",
      href: "/dashboard/lotes?status=quarantine",
      icon: "◷",
    },
    {
      label: "Vencem em até 30 dias",
      value: stats.expiring_count,
      detail: "Priorize a conferência",
      href: "/dashboard/lotes?validade=proximos",
      icon: "↗",
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="Visão geral"
        title="A operação, de perto."
        description="Acompanhe os recebimentos e mantenha cada lote no lugar certo."
      >
        <Link className="btn btn-primary" href="/dashboard/recebimentos/novo">
          <span aria-hidden="true">＋</span>Novo recebimento
        </Link>
      </PageHeading>
      <p className="muted text-xs mb-6">
        Posição atual do estoque · {today.split("-").reverse().join("/")}
      </p>
      <section className="stats-grid" aria-label="Indicadores do estoque">
        {cards.map((c) => (
          <Link href={c.href} className="stat-card" key={c.label}>
            <div className="flex items-center justify-between gap-2">
              <p>{c.label}</p>
              <span aria-hidden="true" className="stat-icon">
                {c.icon}
              </span>
            </div>
            <strong>{c.value}</strong>
            <span>
              {c.detail} <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </section>
      {stats.expired_count > 0 && (
        <Link
          href="/dashboard/lotes?validade=vencidos"
          className="expiry-alert"
        >
          <strong>{stats.expired_count} lote(s) vencido(s) com saldo.</strong>{" "}
          Confira os itens e registre a destinação.{" "}
          <span aria-hidden="true">→</span>
        </Link>
      )}
      <div className="overview-grid">
        <Panel
          title="Movimentações recentes"
          description="Entradas, saídas e conferências registradas pela equipe."
          action={
            <Link className="text-link text-sm" href="/dashboard/movimentacoes">
              Ver todas →
            </Link>
          }
        >
          {recent.data.length ? (
            <MovementsTable movements={recent.data} />
          ) : (
            <EmptyState
              title="O primeiro registro começa aqui"
              description="Cadastre o produto, sua apresentação e o fornecedor. Depois, registre o recebimento para iniciar o estoque."
              href="/dashboard/cadastros/produtos?novo=1"
              label="Cadastrar produto"
            />
          )}
        </Panel>
        <section className="next-steps">
          <span className="badge">Rotina do estoque</span>
          <h2>
            Da chegada
            <br />à liberação.
          </h2>
          <p>Cada etapa deixa um registro para a equipe acompanhar.</p>
          <ol>
            <li>
              <span>01</span>
              <div>
                <strong>Prepare os cadastros</strong>
                <small>Produtos, apresentações e fornecedores.</small>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Registre o recebimento</strong>
                <small>Quantidade, peso, custo e inspeção.</small>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Confira e libere o lote</strong>
                <small>Acompanhe validade, saldo e histórico.</small>
              </div>
            </li>
          </ol>
          <Link href="/dashboard/lotes" className="next-steps-link">
            Consultar estoque <span>→</span>
          </Link>
        </section>
      </div>
    </>
  );
}
