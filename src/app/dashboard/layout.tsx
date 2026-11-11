import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";
import { getAccess } from "@/lib/auth";
import { Navigation } from "@/components/inventory/navigation";
import { SidebarControls } from "@/components/inventory/sidebar-controls";
import { logout } from "./actions";

export const instant = false;
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const access = await getAccess();
  if (access.status !== "ready")
    return (
      <main className="page-inset mx-auto flex min-h-screen max-w-xl items-center">
        <section className="panel panel-inset">
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
  const { data: overview } = await access.supabase.rpc("inventory_overview");
  const stockAlerts = {
    expiring: Number(overview?.[0]?.expiring_count ?? 0),
    expired: Number(overview?.[0]?.expired_count ?? 0),
  };
  return (
    <div className="app-shell">
      <a href="#conteudo" className="skip-link">
        Ir para o conteúdo
      </a>
      <aside className="sidebar">
        <Link
          href="/dashboard"
          className="brand"
          aria-label="Frutalize, ir ao início"
        >
          <Image
            className="brand-logo"
            src="/frutalize-logo.svg"
            alt="Frutalize, polpas de frutas"
            width={190}
            height={77}
            priority
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
        </Link>
        <Navigation
          stockAlerts={stockAlerts}
          account={{
            name: access.member.display_name,
            email: access.user.email ?? "",
            role: access.member.role,
          }}
        />
        <SidebarControls
          account={{
            name: access.member.display_name,
            email: access.user.email ?? "",
            role: access.member.role,
          }}
        />
      </aside>
      <div className="app-body">
        <main id="conteudo" className="app-content layout-stack">
          {children}
        </main>
      </div>
    </div>
  );
}
