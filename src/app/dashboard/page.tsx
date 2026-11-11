import Link from "next/link";
import { Icon, type IconName } from "@/components/inventory/icon";
import { getAccess } from "@/lib/auth";

export const instant = false;

type HomeCard = {
  title: string;
  description: string;
  icon: IconName;
  href: string;
};

const quickActions: HomeCard[] = [
  {
    title: "Receber mercadoria",
    description:
      "Dê entrada em frutas, embalagens, insumos e outros materiais.",
    icon: "receive",
    href: "/dashboard/recebimentos/novo",
  },
  {
    title: "Acompanhar produção",
    description: "Consulte ordens e lotes produzidos no dashboard.",
    icon: "production",
    href: "/dashboard/producao",
  },
  {
    title: "Registrar venda",
    description: "Registre uma saída comercial e mantenha o saldo atualizado.",
    icon: "sale",
    href: "/dashboard/gestao/commercial",
  },
  {
    title: "Lançar conta ou despesa",
    description: "Organize os compromissos financeiros da operação.",
    icon: "finance",
    href: "/dashboard/gestao/finance",
  },
];

const modules: HomeCard[] = [
  {
    title: "Estoque",
    description: "Consulte saldos, lotes, validades e locais de armazenamento.",
    icon: "inventory",
    href: "/dashboard/lotes",
  },
  {
    title: "Produção",
    description: "Acompanhe ordens, consumo de insumos e lotes produzidos.",
    icon: "production",
    href: "/dashboard/producao",
  },
  {
    title: "Financeiro",
    description:
      "Contas a pagar, a receber, caixa e conciliação em um só lugar.",
    icon: "finance",
    href: "/dashboard/gestao/finance",
  },
  {
    title: "Vendas",
    description: "Acompanhe pedidos e saídas para clientes B2B e B2C.",
    icon: "sale",
    href: "/dashboard/gestao/commercial",
  },
  {
    title: "Equipe e acessos",
    description: "Gerencie administradores, gestores e colaboradores.",
    icon: "users",
    href: "/dashboard/gestao/staff",
  },
  {
    title: "Cadastros",
    description: "Itens, tamanhos, embalagens, fornecedores e locais.",
    icon: "catalog",
    href: "/dashboard/cadastros",
  },
  {
    title: "Histórico e auditoria",
    description: "Veja quem alterou cada informação e quando isso aconteceu.",
    icon: "history",
    href: "/dashboard/historico",
  },
];

function HomeActionCard({ card }: { card: HomeCard }) {
  return (
    <Link className="task-card" href={card.href}>
      <div className="home-card-topline">
        <span className="home-card-icon" aria-hidden="true">
          <Icon name={card.icon} size={25} />
        </span>
      </div>
      <div>
        <h3>{card.title}</h3>
        <p>{card.description}</p>
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const access = await getAccess();
  if (access.status !== "ready") return null;
  const firstName = access.member.display_name.trim().split(/\s+/)[0];
  return (
    <>
      <h1 className="home-greeting">Olá, {firstName || "administrador"}.</h1>
      <section className="home-section" aria-labelledby="quick-actions-title">
        <div className="home-section-heading">
          <h2 id="quick-actions-title">O que você precisa fazer agora?</h2>
        </div>
        <div className="task-card-grid">
          {quickActions.map((card) => (
            <HomeActionCard card={card} key={card.title} />
          ))}
        </div>
      </section>
      <section className="home-section" aria-labelledby="modules-title">
        <div className="home-section-heading">
          <h2 id="modules-title">Áreas da empresa</h2>
        </div>
        <div className="task-card-grid">
          {modules.map((card) => (
            <HomeActionCard card={card} key={card.title} />
          ))}
        </div>
      </section>
    </>
  );
}
