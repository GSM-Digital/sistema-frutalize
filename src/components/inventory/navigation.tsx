"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icon";

type NavItem = {
  label: string;
  shortLabel?: string;
  icon: IconName;
  href?: string;
  planned?: boolean;
};

const sections: { label?: string; items: NavItem[] }[] = [
  {
    items: [{ href: "/dashboard", label: "Início", icon: "overview" }],
  },
  {
    label: "Visualizações",
    items: [{ href: "/terminal", label: "Terminal touch", icon: "production" }],
  },
  {
    label: "Rotina",
    items: [
      {
        href: "/dashboard/recebimentos/novo",
        label: "Receber mercadoria",
        shortLabel: "Receber",
        icon: "receive",
      },
      {
        href: "/dashboard/producao",
        label: "Produção",
        shortLabel: "Produção",
        icon: "production",
      },
      {
        href: "/dashboard/gestao/commercial",
        label: "Pedidos e expedição",
        icon: "sale",
      },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/dashboard/lotes", label: "Estoque", icon: "inventory" },
      {
        href: "/dashboard/gestao/finance",
        label: "Financeiro",
        icon: "finance",
      },
      {
        href: "/dashboard/gestao/staff",
        label: "Equipe e acessos",
        icon: "users",
      },
      {
        href: "/dashboard/gestao/inventory",
        label: "Inventário físico",
        icon: "inventory",
      },
    ],
  },
  {
    label: "Controle",
    items: [
      {
        href: "/dashboard/cadastros",
        label: "Cadastros",
        icon: "catalog",
      },
      {
        href: "/dashboard/historico",
        label: "Histórico e auditoria",
        shortLabel: "Histórico",
        icon: "history",
      },
      {
        href: "/dashboard/producao/configuracao",
        label: "Procedimentos e qualidade",
        icon: "production",
      },
      {
        href: "/dashboard/gestao/receiving",
        label: "Inspeções e documentos",
        icon: "receive",
      },
      {
        href: "/dashboard/gestao/alerts",
        label: "Alertas e temperaturas",
        icon: "overview",
      },
      {
        href: "/dashboard/gestao/time",
        label: "Apontamentos",
        icon: "history",
      },
    ],
  },
];

export function Navigation() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  const shortcuts: NavItem[] = [
    { href: "/dashboard", label: "Início", icon: "overview" },
    { href: "/dashboard/producao", label: "Produção", icon: "production" },
    { href: "/dashboard/lotes", label: "Estoque", icon: "inventory" },
    { href: "/terminal", label: "Terminal", icon: "production" },
  ];
  return (
    <>
      <nav className="main-nav" aria-label="Menu principal">
        {sections.map((section, sectionIndex) => (
          <section className="nav-section" key={section.label ?? sectionIndex}>
            {section.label && (
              <p className="nav-section-title">{section.label}</p>
            )}
            <div className="nav-section-items">
              {section.items.map((item) => {
                if (!item.href) {
                  return (
                    <span
                      key={item.label}
                      className="nav-item nav-item-planned"
                      aria-disabled="true"
                      title={`${item.label}: em breve`}
                    >
                      <span aria-hidden="true" className="nav-icon">
                        <Icon name={item.icon} />
                      </span>
                      <span className="nav-item-label">{item.label}</span>
                      <small>Em breve</small>
                    </span>
                  );
                }
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`nav-item${active ? " nav-active" : ""}`}
                  >
                    <span aria-hidden="true" className="nav-icon">
                      <Icon name={item.icon} />
                    </span>
                    <span className="nav-item-label nav-label-full">
                      {item.label}
                    </span>
                    <span className="nav-item-label nav-label-short">
                      {item.shortLabel ?? item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
      <nav className="mobile-nav" aria-label="Menu móvel">
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href!}
            aria-current={isActive(item.href!) ? "page" : undefined}
            className={`mobile-nav-link${isActive(item.href!) ? " mobile-nav-active" : ""}`}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
        <details className="mobile-nav-more" key={pathname}>
          <summary className="mobile-nav-link">
            <span className="mobile-nav-more-icon" aria-hidden="true">
              ☰
            </span>
            <span>Mais</span>
          </summary>
          <div className="mobile-nav-panel">
            <p className="mobile-nav-panel-title">Todas as áreas</p>
            {sections.map((section, index) => (
              <section key={section.label ?? index}>
                {section.label && <h2>{section.label}</h2>}
                {section.items
                  .filter((item) => item.href)
                  .map((item) => (
                    <Link
                      key={item.href}
                      href={item.href!}
                      aria-current={isActive(item.href!) ? "page" : undefined}
                      className={`mobile-nav-panel-link${isActive(item.href!) ? " mobile-nav-active" : ""}`}
                    >
                      <Icon name={item.icon} />
                      <span>{item.label}</span>
                    </Link>
                  ))}
              </section>
            ))}
          </div>
        </details>
      </nav>
    </>
  );
}
