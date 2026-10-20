import Link from "next/link";
import { getAccess } from "@/lib/auth";
import { Navigation } from "@/components/inventory/navigation";
import { logout } from "./actions";

export const instant = false;
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getAccess();
  if (access.status !== "ready")
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-5">
        <section className="panel p-7">
          <p className="eyebrow">Sistema Frutalize</p>
          <h1 className="mt-3 text-2xl font-semibold">
            {access.status === "forbidden"
              ? "Acesso aguardando liberação"
              : "Estoque em preparação"}
          </h1>
          <p className="muted mt-4 leading-7">
            {access.status === "forbidden"
              ? "Nesta fase, o estoque está disponível para administradores autorizados. Solicite a liberação ao responsável pelo sistema."
              : "O administrador precisa concluir a preparação do ambiente para liberar o estoque."}
          </p>
          <form action={logout} className="mt-6">
            <button type="submit" className="btn btn-secondary">
              Voltar ao login
            </button>
          </form>
        </section>
      </main>
    );
  return (
    <div className="app-shell">
      <a href="#conteudo" className="skip-link">
        Ir para o conteúdo
      </a>
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <span className="brand-mark" aria-hidden="true">
            F<span>•</span>
          </span>
          <span>
            Frutalize<small>Gestão da fábrica</small>
          </span>
        </Link>
        <Navigation />
        <div className="sidebar-footer">
          <span className="badge badge-green">Uso interno</span>
          <p>
            Uma operação mais organizada,
            <br />
            do recebimento ao estoque.
          </p>
        </div>
      </aside>
      <div className="app-body">
        <header className="app-header">
          <div>
            <span className="header-dot" aria-hidden="true" />
            Unidade Frutalize
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-semibold max-w-64">
                {access.member.display_name}
              </p>
              <p className="muted text-xs">Administrador</p>
            </div>
            <form action={logout}>
              <button type="submit" className="btn btn-secondary">
                Sair
              </button>
            </form>
          </div>
        </header>
        <main id="conteudo" className="app-content">
          {children}
        </main>
        <footer className="app-footer">
          Sistema Frutalize <span>Horário de Brasília · Operação online</span>
        </footer>
      </div>
    </div>
  );
}
