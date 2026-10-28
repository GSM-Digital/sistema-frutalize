import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardOperations } from "@/components/production/dashboard-operations";
import { ProductionTerminal } from "@/components/production/terminal";
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
        className="flex flex-wrap gap-2 border-b border-green-900/10 bg-white p-4"
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
        <span className="self-center text-sm text-green-900/70">
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
              <span className="brand-mark">
                F<span>•</span>
              </span>
              <span>
                Frutalize<small>Gestão da fábrica</small>
              </span>
            </div>
            <nav className="main-nav" aria-label="Menu demonstrativo">
              <section className="nav-section">
                <p className="nav-section-title">Rotina</p>
                <div className="nav-section-items">
                  <span className="nav-item nav-active">Produção</span>
                </div>
              </section>
              <section className="nav-section">
                <p className="nav-section-title">Gestão</p>
                <div className="nav-section-items">
                  <span className="nav-item">Estoque</span>
                  <span className="nav-item">Financeiro</span>
                </div>
              </section>
            </nav>
          </aside>
          <div className="app-body">
            <header className="app-header">
              <div>
                <span className="header-dot" aria-hidden="true" /> Unidade
                Frutalize
              </div>
              <span>Administrador(a) de exemplo</span>
            </header>
            <main className="app-content">
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    Dashboard administrativo · Prévia local
                  </p>
                  <h1>Ordem {previewSnapshot.runs[0].code}</h1>
                  <p className="muted mt-2">
                    Acompanhamento e operação em painéis administrativos.
                  </p>
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
