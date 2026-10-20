"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icon";
const links = [
  ["/dashboard", "Visão geral", "overview"],
  ["/dashboard/lotes", "Estoque e lotes", "inventory"],
  ["/dashboard/movimentacoes", "Movimentações", "movements"],
  ["/dashboard/cadastros/produtos", "Produtos", "product"],
  ["/dashboard/cadastros/apresentacoes", "Apresentações", "variant"],
  ["/dashboard/cadastros/fornecedores", "Fornecedores", "supplier"],
  ["/dashboard/cadastros/locais", "Locais de estoque", "location"],
  ["/dashboard/cadastros/categorias", "Categorias", "category"],
  ["/dashboard/historico", "Histórico de alterações", "history"],
] as const;
export function Navigation() {
  const pathname = usePathname();
  return (
    <nav className="main-nav" aria-label="Menu principal">
      {links.map(([href, label, icon]) => {
        const active =
          href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={active ? "nav-active" : ""}
          >
            <span aria-hidden="true" className="nav-icon">
              <Icon name={icon} />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
