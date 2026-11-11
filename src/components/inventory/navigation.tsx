"use client";
import { ReportTrigger } from "@/components/support/report-dialog";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "@/app/dashboard/actions";

type NavItem = {
  label: string;
  shortLabel?: string;
  icon: IconName;
  href?: string;
  planned?: boolean;
};

const sections: { label?: string; mobileOnly?: boolean; items: NavItem[] }[] = [
  {
    items: [{ href: "/dashboard", label: "Início", icon: "overview" }],
  },
  {
    label: "Visualizações",
    mobileOnly: true,
    items: [
      {
        href: "/terminal",
        label: "Terminal touch · despolpa",
        icon: "production",
      },
      {
        href: "/terminal/preparo",
        label: "Terminal touch · preparo",
        icon: "production",
      },
    ],
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
        href: "/dashboard/preparo",
        label: "Preparo de frutas",
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
      { href: "/dashboard/suporte", label: "Suporte", icon: "bug" },
    ],
  },
];

type StockAlerts = { expiring: number; expired: number };

function StockBadges({
  alerts,
  mobile = false,
}: {
  alerts: StockAlerts;
  mobile?: boolean;
}) {
  if (!alerts.expiring && !alerts.expired) return null;
  return (
    <span
      className={mobile ? "stock-alerts stock-alerts-mobile" : "stock-alerts"}
      aria-label={`${alerts.expiring} lotes próximos do vencimento; ${alerts.expired} lotes vencidos`}
    >
      {alerts.expiring > 0 && (
        <span
          className="stock-alert-badge stock-alert-badge-expiring"
          title={`${alerts.expiring} lotes vencem em até 30 dias`}
        >
          {alerts.expiring}
        </span>
      )}
      {alerts.expired > 0 && (
        <span
          className="stock-alert-badge stock-alert-badge-expired"
          title={`${alerts.expired} lotes vencidos`}
        >
          {alerts.expired}
        </span>
      )}
    </span>
  );
}

export function Navigation({
  stockAlerts = { expiring: 0, expired: 0 },
  account,
}: {
  stockAlerts?: StockAlerts;
  account: { name: string; email: string; role: string };
}) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const menuOpen = openPath === pathname;
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<number | null>(null);
  const contentTouchStart = useRef<number | null>(null);
  const moreTouchStart = useRef<number | null>(null);
  const suppressMoreClick = useRef(false);
  const suppressHandleClick = useRef(false);
  const ignoreScrollUntil = useRef(0);
  const moreButton = useRef<HTMLButtonElement>(null);
  const sheetHandle = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const setMenuOpen = (next: boolean) => setOpenPath(next ? pathname : null);

  useEffect(() => {
    const mobileNavigation = window.matchMedia("(max-width: 1023px)");
    const onChange = () => {
      if (!mobileNavigation.matches) setOpenPath(null);
    };
    mobileNavigation.addEventListener("change", onChange);
    return () => mobileNavigation.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const sidebar = document.querySelector<HTMLElement>(".sidebar");
    if (!sidebar) return;
    const mobile = window.matchMedia("(max-width: 639px)");
    let previousY = window.scrollY;
    let travel = 0;
    const onScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - previousY;
      previousY = currentY;
      if (performance.now() < ignoreScrollUntil.current) {
        sidebar.classList.remove("sidebar-hidden");
        travel = 0;
        return;
      }
      if (!mobile.matches || menuOpen || currentY < 32) {
        sidebar.classList.remove("sidebar-hidden");
        travel = 0;
        return;
      }
      travel = Math.sign(travel) === Math.sign(delta) ? travel + delta : delta;
      if (travel > 16) {
        sidebar.classList.add("sidebar-hidden");
        travel = 0;
      } else if (travel < -12) {
        sidebar.classList.remove("sidebar-hidden");
        travel = 0;
      }
    };
    const onResize = () => {
      if (!mobile.matches) sidebar.classList.remove("sidebar-hidden");
      previousY = window.scrollY;
      travel = 0;
    };
    if (menuOpen) sidebar.classList.remove("sidebar-hidden");
    window.addEventListener("scroll", onScroll, { passive: true });
    mobile.addEventListener("change", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      mobile.removeEventListener("change", onResize);
      sidebar.classList.remove("sidebar-hidden");
    };
  }, [menuOpen, pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const root = document.documentElement;
    const appBody = document.querySelector<HTMLElement>(".app-body");
    const brand = document.querySelector<HTMLElement>(".sidebar .brand");
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
      rootOverflow: root.style.overflow,
      appInert: appBody?.inert,
      brandInert: brand?.inert,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    if (appBody) appBody.inert = true;
    if (brand) brand.inert = true;
    const focus = window.requestAnimationFrame(() =>
      sheetHandle.current?.focus(),
    );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPath(null);
        moreButton.current?.focus();
      }
      if (event.key !== "Tab" || !sheet.current) return;
      const focusable = Array.from(
        sheet.current.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled])",
        ),
      );
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === focusable.at(-1)
      ) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focus);
      window.removeEventListener("keydown", onKeyDown);
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      root.style.overflow = previous.rootOverflow;
      if (appBody) appBody.inert = previous.appInert ?? false;
      if (brand) brand.inert = previous.brandInert ?? false;
      ignoreScrollUntil.current = performance.now() + 180;
      if (window.location.pathname === pathname) window.scrollTo(0, scrollY);
    };
  }, [menuOpen, pathname]);

  function releaseDrag(clientY: number) {
    if (dragStart.current === null) return;
    const distance = Math.max(0, clientY - dragStart.current);
    dragStart.current = null;
    setDragging(false);
    setDragOffset(0);
    if (distance > 80) setMenuOpen(false);
    if (distance > 5) suppressHandleClick.current = true;
  }
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  const shortcuts: NavItem[] = [
    { href: "/dashboard", label: "Início", icon: "overview" },
    { href: "/dashboard/producao", label: "Produção", icon: "production" },
    { href: "/dashboard/lotes", label: "Estoque", icon: "inventory" },
  ];
  const shortcutIndex = shortcuts.findIndex((item) => isActive(item.href!));
  const moreIndex = shortcuts.length;
  const activeIndex = menuOpen || shortcutIndex < 0 ? moreIndex : shortcutIndex;
  return (
    <>
      <nav className="main-nav" aria-label="Menu principal">
        {sections
          .filter((section) => !section.mobileOnly)
          .map((section, sectionIndex) => (
            <section
              className="nav-section"
              key={section.label ?? sectionIndex}
            >
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
                      aria-label={
                        item.href === "/dashboard/lotes" &&
                        (stockAlerts.expiring || stockAlerts.expired)
                          ? `${item.label}: ${stockAlerts.expiring} lotes próximos do vencimento e ${stockAlerts.expired} vencidos`
                          : item.label
                      }
                      title={item.label}
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
                      {item.href === "/dashboard/lotes" && (
                        <StockBadges alerts={stockAlerts} />
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
      </nav>
      <nav className="mobile-nav" aria-label="Menu móvel">
        <span
          className="mobile-nav-indicator"
          aria-hidden="true"
          style={{
            transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 0.15}rem))`,
          }}
        />
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href!}
            aria-current={isActive(item.href!) ? "page" : undefined}
            className={`mobile-nav-link${isActive(item.href!) ? " mobile-nav-active" : ""}`}
          >
            <span className="mobile-nav-icon-wrap">
              <Icon name={item.icon} />
              {item.href === "/dashboard/lotes" && (
                <StockBadges alerts={stockAlerts} mobile />
              )}
            </span>
            <span>{item.label}</span>
          </Link>
        ))}
        <button
          ref={moreButton}
          type="button"
          className={`mobile-nav-link mobile-nav-more${activeIndex === moreIndex ? " mobile-nav-active" : ""}`}
          aria-expanded={menuOpen}
          aria-controls="mobile-more-sheet"
          onClick={() => {
            if (suppressMoreClick.current) {
              suppressMoreClick.current = false;
              return;
            }
            setMenuOpen(!menuOpen);
          }}
          onTouchStart={(event) => {
            moreTouchStart.current = event.touches[0]?.clientY ?? null;
          }}
          onTouchEnd={(event) => {
            if (moreTouchStart.current === null) return;
            const distance =
              moreTouchStart.current -
              (event.changedTouches[0]?.clientY ?? moreTouchStart.current);
            moreTouchStart.current = null;
            if (distance > 35) {
              suppressMoreClick.current = true;
              setMenuOpen(true);
              window.setTimeout(() => {
                suppressMoreClick.current = false;
              }, 450);
            }
          }}
        >
          <span className="mobile-nav-more-icon" aria-hidden="true">
            ☰
          </span>
          <span>Mais</span>
        </button>
      </nav>
      <button
        type="button"
        className={`mobile-nav-backdrop${menuOpen ? " mobile-nav-backdrop-open" : ""}`}
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => setMenuOpen(false)}
      />
      <div
        id="mobile-more-sheet"
        ref={sheet}
        className={`mobile-nav-panel${menuOpen ? " mobile-nav-panel-open" : ""}`}
        role="dialog"
        aria-modal={menuOpen}
        aria-labelledby="mobile-nav-panel-title"
        aria-hidden={!menuOpen}
        inert={!menuOpen}
        style={
          menuOpen
            ? {
                transform: `translateY(${dragOffset}px)`,
                transition: dragging ? "none" : undefined,
              }
            : undefined
        }
      >
        <button
          ref={sheetHandle}
          type="button"
          className="mobile-nav-handle"
          aria-label="Deslize para baixo ou toque para fechar o menu"
          onClick={() => {
            if (suppressHandleClick.current) {
              suppressHandleClick.current = false;
              return;
            }
            setMenuOpen(false);
          }}
          onPointerDown={(event) => {
            dragStart.current = event.clientY;
            setDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragStart.current !== null)
              setDragOffset(Math.max(0, event.clientY - dragStart.current));
          }}
          onPointerUp={(event) => {
            releaseDrag(event.clientY);
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            dragStart.current = null;
            setDragging(false);
            setDragOffset(0);
          }}
        >
          <span aria-hidden="true" />
        </button>
        <div
          className="mobile-nav-panel-content"
          onTouchStart={(event) => {
            contentTouchStart.current =
              event.currentTarget.scrollTop === 0
                ? (event.touches[0]?.clientY ?? null)
                : null;
          }}
          onTouchEnd={(event) => {
            if (contentTouchStart.current === null) return;
            const distance =
              (event.changedTouches[0]?.clientY ?? contentTouchStart.current) -
              contentTouchStart.current;
            contentTouchStart.current = null;
            if (distance > 90 && event.currentTarget.scrollTop === 0)
              setMenuOpen(false);
          }}
        >
          <div className="mobile-nav-panel-heading">
            <p id="mobile-nav-panel-title" className="mobile-nav-panel-title">
              Todas as áreas
            </p>
            <div className="mobile-nav-panel-actions">
              <ThemeToggle />
              <ReportTrigger
                className="mobile-nav-report"

                onOpen={() => setMenuOpen(false)}
              >
                <Icon name="bug" size={22} />
              </ReportTrigger>
            </div>
          </div>
          {sections.map((section, index) => (
            <section key={section.label ?? index}>
              {section.label && <h2>{section.label}</h2>}
              {section.label === "Controle" && (
                <div
                  className="mobile-nav-account"
                  aria-label="Usuário conectado"
                >
                  <strong>{account.name}</strong>
                  <span>{account.email}</span>
                  <small>
                    {account.role === "admin"
                      ? "Administrador"
                      : account.role === "manager"
                        ? "Gestor"
                        : "Colaborador"}
                  </small>
                </div>
              )}
              {section.items
                .filter((item) => item.href)
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href!}
                    aria-current={isActive(item.href!) ? "page" : undefined}
                    className={`mobile-nav-panel-link${isActive(item.href!) ? " mobile-nav-active" : ""}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                ))}
            </section>
          ))}
          <Link
            href="/dashboard/conta"
            className="mobile-nav-panel-link"
            onClick={() => setMenuOpen(false)}
          >
            <Icon name="users" />
            <span>Conta</span>
          </Link>
          <form action={logout}>
            <button className="mobile-nav-logout" type="submit">
              Sair do sistema
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
