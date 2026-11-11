"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/dashboard/actions";

const storageKey = "frutalize-sidebar-collapsed";

export function SidebarControls({
  account,
}: {
  account: { name: string; email: string; role: string };
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey) === "true";
    document
      .querySelector(".app-shell")
      ?.classList.toggle("sidebar-collapsed", saved);
    const frame = window.requestAnimationFrame(() => setCollapsed(saved));
    return () => {
      window.cancelAnimationFrame(frame);
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
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setMenuOpen(true), 1000);
  }

  function endHover() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setMenuOpen(false);
  }

  return (
    <div
      className="sidebar-controls"
      onMouseEnter={startHover}
      onMouseLeave={endHover}
    >
      <button
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
        <div className="sidebar-account-menu">
          <div className="sidebar-account-info" aria-label="Usuário conectado">
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
          <Link href="/dashboard/conta" onClick={() => setMenuOpen(false)}>
            Conta
          </Link>
          <form action={logout}>
            <button type="submit">Sair</button>
          </form>
        </div>
      )}
    </div>
  );
}
