import Link from "next/link";
import { Icon, type IconName } from "@/components/inventory/icon";
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

type HomeCard = {
  title: string;
  description: string;
  icon: IconName;
  href?: string;
  status?: string;
  statusTone?: "green" | "neutral";
};

const quickActions: HomeCard[] = [
  {
    title: "Receber mercadoria",
    description:
      "Dê entrada em frutas, embalagens, insumos e outros materiais.",
    icon: "receive",
    href: "/dashboard/recebimentos/novo",
    status: "Disponível agora",
    statusTone: "green",
  },
  {
    title: "Iniciar produção",
    description:
      "Registre os insumos consumidos e os lotes de polpa produzidos.",
    icon: "production",
    status: "Em breve",
  },
  {
    title: "Registrar venda",
    description: "Registre uma saída comercial e mantenha o saldo atualizado.",
    icon: "sale",
    status: "Em breve",
  },
  {
    title: "Lançar conta ou despesa",
    description: "Organize os compromissos financeiros da operação.",
    icon: "finance",
    status: "Em breve",
  },
];

const modules: HomeCard[] = [
  {
    title: "Estoque",
    description: "Consulte saldos, lotes, validades e locais de armazenamento.",
    icon: "inventory",
    href: "/dashboard/lotes",
    status: "Em operação",
    statusTone: "green",
  },
  {
    title: "Produção",
    description: "Planeje e registre a transformação de insumos em produtos.",
    icon: "production",
    status: "Próxima etapa",
  },
  {
    title: "Financeiro",
    description:
      "Contas a pagar, a receber, caixa e conciliação em um só lugar.",
    icon: "finance",
    status: "Próxima etapa",
  },
  {
    title: "Vendas",
    description: "Acompanhe pedidos e saídas para clientes B2B e B2C.",
    icon: "sale",
    status: "Planejado",
  },
  {
    title: "Equipe e acessos",
    description: "Gerencie administradores, gestores e colaboradores.",
    icon: "users",
    status: "Planejado",
  },
  {
    title: "Cadastros",
    description: "Itens, tamanhos, embalagens, fornecedores e locais.",
    icon: "catalog",
    href: "/dashboard/cadastros",
    status: "Disponível",
    statusTone: "green",
  },
  {
    title: "Histórico e auditoria",
    description: "Veja quem alterou cada informação e quando isso aconteceu.",
    icon: "history",
    href: "/dashboard/historico",
    status: "Disponível",
    statusTone: "green",
  },
];

function TaskCard({ card }: { card: HomeCard }) {
  const content = (
    <>
      <div className="home-card-topline">
        <span className="home-card-icon" aria-hidden="true">
          <Icon name={card.icon} size={25} />
        </span>
        <span
          className={`badge${card.statusTone === "green" ? " badge-green" : ""}`}
        >
          {card.status}
        </span>
      </div>
      <div>
        <h3>{card.title}</h3>
        <p>{card.description}</p>
      </div>
      {card.href && (
        <span className="home-card-arrow" aria-hidden="true">
          →
        </span>
      )}
    </>
  );

  return card.href ? (
    <Link className="task-card" href={card.href}>
      {content}
    </Link>
  ) : (
    <article className="task-card card-planned" data-state="planned">
      {content}
    </article>
  );
}

function ModuleCard({ card }: { card: HomeCard }) {
  const content = (
    <>
      <span className="module-card-icon" aria-hidden="true">
        <Icon name={card.icon} size={23} />
      </span>
      <div className="module-card-copy">
        <div className="module-card-title">
          <h3>{card.title}</h3>
          {card.href && <span aria-hidden="true">→</span>}
        </div>
        <p>{card.description}</p>
      </div>
      <span
        className={`badge${card.statusTone === "green" ? " badge-green" : ""}`}
      >
        {card.status}
      </span>
    </>
  );

  return card.href ? (
    <Link className="module-card" href={card.href}>
      {content}
    </Link>
  ) : (
    <article className="module-card card-planned" data-state="planned">
      {content}
    </article>
  );
}

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
      .limit(5),
  ]);
  if (overview.error || recent.error || !overview.data?.[0])
    return <DataNotice />;

  const stats = overview.data[0];
  const today = businessDate();
  const firstName = access.member.display_name.trim().split(/\s+/)[0];
  const stockStats = [
    {
      label: "Itens ativos",
      value: stats.products_count,
      href: "/dashboard/cadastros/produtos",
    },
    {
      label: "Lotes com saldo",
      value: stats.lots_count,
      href: "/dashboard/lotes",
    },
    {
      label: "Em quarentena",
      value: stats.quarantine_count,
      href: "/dashboard/lotes?status=quarantine",
    },
    {
      label: "Vencem em 30 dias",
      value: stats.expiring_count,
      href: "/dashboard/lotes?validade=proximos",
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow="Início"
        title={`Olá, ${firstName || "administrador"}.`}
        description="Escolha uma tarefa do dia a dia ou acesse uma área da empresa."
      />

      <section className="home-section" aria-labelledby="quick-actions-title">
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">Atalhos operacionais</p>
            <h2 id="quick-actions-title">O que você precisa fazer agora?</h2>
          </div>
          <p>Comece pela tarefa, sem precisar procurar em vários menus.</p>
        </div>
        <div className="task-card-grid">
          {quickActions.map((card) => (
            <TaskCard card={card} key={card.title} />
          ))}
        </div>
      </section>

      <section className="home-section" aria-labelledby="modules-title">
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">Sistema Frutalize</p>
            <h2 id="modules-title">Áreas da empresa</h2>
          </div>
          <p>
            Os módulos planejados já aparecem no mapa, sem simular funções
            prontas.
          </p>
        </div>
        <div className="module-card-grid">
          {modules.map((card) => (
            <ModuleCard card={card} key={card.title} />
          ))}
        </div>
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

      <section className="home-insights-grid" aria-label="Resumo da operação">
        <Panel
          title="Situação do estoque"
          description={`Posição atual em ${today.split("-").reverse().join("/")}.`}
          action={
            <Link className="text-link text-sm" href="/dashboard/lotes">
              Abrir estoque →
            </Link>
          }
        >
          <div className="stock-snapshot-grid">
            {stockStats.map((stat) => (
              <Link href={stat.href} key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel
          title="Atividade recente"
          description="Últimos registros feitos no estoque."
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
              description="Prepare os cadastros e registre um recebimento para iniciar o estoque."
              href="/dashboard/cadastros"
              label="Preparar cadastros"
            />
          )}
        </Panel>
      </section>
    </>
  );
}
