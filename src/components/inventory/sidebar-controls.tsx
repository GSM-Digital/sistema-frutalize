"use client";

import { Icon } from "./icon";
import { useOverlayFocus } from "@/components/use-overlay-focus";
import { ReportTrigger } from "@/components/support/report-dialog";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "@/app/dashboard/actions";

const storageKey = "frutalize-sidebar-collapsed";

export function SidebarControls({
  account,
}: {
  account: { name: string; email: string; role: string };
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const controls = useRef<HTMLDivElement>(null);
  const toggleButton = useRef<HTMLButtonElement>(null);
  useOverlayFocus(controls, menuOpen, false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey) === "true";
    document
      .querySelector(".app-shell")
      ?.classList.toggle("sidebar-collapsed", saved);
    const frame = window.requestAnimationFrame(() => setCollapsed(saved));
    const desktop = window.matchMedia("(min-width: 1024px)");
    function closeOnMobile() {
      if (desktop.matches) return;
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      setMenuOpen(false);
    }
    desktop.addEventListener("change", closeOnMobile);
    return () => {
      window.cancelAnimationFrame(frame);
      desktop.removeEventListener("change", closeOnMobile);
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      document
        .querySelector(".app-shell")
        ?.classList.remove("sidebar-collapsed");
    };
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(storageKey, String(next));
    document
      .querySelector(".app-shell")
      ?.classList.toggle("sidebar-collapsed", next);
  }

  function startHover() {
    if (menuOpen) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setMenuOpen(true), 1000);
  }

  function endHover() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }

  function dismissMenu(restoreFocus = false) {
    endHover();
    if (restoreFocus) toggleButton.current?.focus();
    setMenuOpen(false);
  }

  return (
    <div
      ref={controls}
      className={`sidebar-controls${menuOpen ? " sidebar-controls-open" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          event.preventDefault();
          dismissMenu(true);
        }
      }}
      onMouseEnter={startHover}
      onMouseLeave={endHover}
    >
      {menuOpen && (
        <button
          type="button"
          className="sidebar-account-backdrop"
          aria-label="Fechar menu"
          tabIndex={-1}
          onClick={() => dismissMenu()}
        />
      )}
      <button
        ref={toggleButton}
        type="button"
        className="sidebar-toggle"
        aria-label={
          collapsed ? "Expandir menu lateral" : "Recolher menu lateral"
        }
        aria-expanded={!collapsed}
        onClick={toggle}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) setMenuOpen(true);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget))
            setMenuOpen(false);
        }}
      >
        <span aria-hidden="true">☰</span>
        <span className="sidebar-toggle-label">Menu</span>
      </button>
      {menuOpen && (
        <div
          className="sidebar-account-menu"
          role="group"
          aria-label="Opções da conta"
        >
          <div className="sidebar-account-heading">
            <div
              className="sidebar-account-info"
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
            <div className="sidebar-account-actions">
              <ThemeToggle />
              <ReportTrigger
                className="mobile-nav-report"
                onOpen={() => dismissMenu()}
              >
                <Icon name="bug" size={22} />
              </ReportTrigger>
            </div>
          </div>
          <Link href="/dashboard/conta" onClick={() => setMenuOpen(false)}>
            Conta
          </Link>
          <Link href="/terminal" onClick={() => setMenuOpen(false)}>
            Terminal Touch
          </Link>
          <form action={logout}>
            <button type="submit">Sair</button>
          </form>
        </div>
      )}
    </div>
  );
}
