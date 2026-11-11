import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { DashboardOperations } from "@/components/production/dashboard-operations";
import { ProductionTerminal } from "@/components/production/terminal";
import { Navigation } from "@/components/inventory/navigation";
import { SidebarControls } from "@/components/inventory/sidebar-controls";
import { previewRunId, previewSnapshot } from "@/lib/production/preview";

export const instant = false;

export default async function VisualizarPage({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { visao } = await searchParams;
  const terminal = visao === "terminal" || visao === "fila";
  return (
    <div>
      <nav
        className="flex flex-wrap gap-2 border-b border-line bg-surface p-4"
        aria-label="Prévia local"
      >
        <Link
          className={`btn ${!terminal ? "btn-primary" : "btn-secondary"}`}
          href="/visualizar"
        >
          Dashboard
        </Link>
        <Link
          className={`btn ${visao === "terminal" ? "btn-primary" : "btn-secondary"}`}
          href="/visualizar?visao=terminal"
        >
          Terminal · ordem
        </Link>
        <Link
          className={`btn ${visao === "fila" ? "btn-primary" : "btn-secondary"}`}
          href="/visualizar?visao=fila"
        >
          Terminal · fila
        </Link>
        <span className="self-center text-sm text-muted">
          Dados fictícios, sem conexão com o banco. Ações desativadas.
        </span>
      </nav>
      {terminal ? (
        <ProductionTerminal
          key={visao}
          initial={previewSnapshot}
          initialRunId={visao === "terminal" ? previewRunId : undefined}
          preview
        />
      ) : (
        <div className="app-shell">
          <aside className="sidebar">
            <div className="brand">
              <Image
                className="brand-logo"
                src="/frutalize-logo.svg"
                alt="Frutalize, polpas de frutas"
                width={190}
                height={77}
                unoptimized
              />
              <Image
                className="brand-mark"
                src="/icon.svg"
                alt=""
                width={42}
                height={42}
                unoptimized
              />
            </div>
            <Navigation
              stockAlerts={{ expiring: 2, expired: 3 }}
              account={{
                name: "Administrador Frutalize",
                email: "admin@frutalize.example",
                role: "admin",
              }}
            />
            <SidebarControls
              account={{
                name: "Administrador Frutalize",
                email: "admin@frutalize.example",
                role: "admin",
              }}
            />
          </aside>
          <div className="app-body">
            <main className="app-content">
              <div className="page-heading">
                <div>
                  <h1>Ordem {previewSnapshot.runs[0].code}</h1>
                </div>
              </div>
              <DashboardOperations
                initial={previewSnapshot}
                runId={previewRunId}
                preview
              />
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
