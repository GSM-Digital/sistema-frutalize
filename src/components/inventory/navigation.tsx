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
        label: "Produzir",
        icon: "production",
      },
      { label: "Registrar venda", icon: "sale", planned: true },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/dashboard/lotes", label: "Estoque", icon: "inventory" },
      { label: "Financeiro", icon: "finance", planned: true },
      { label: "Equipe e acessos", icon: "users", planned: true },
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
    ],
  },
];

export function Navigation() {
  const pathname = usePathname();
  return (
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
              const active =
                item.href === "/dashboard"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
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
  );
}
