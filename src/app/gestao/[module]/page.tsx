import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getProductionAccess } from "@/lib/auth";
import {
  operationsModules,
  type OperationsModule,
} from "@/lib/operations/types";
import { moduleNames } from "@/lib/operations/forms";
import {
  OperationsWorkspace,
  type Snapshot,
} from "@/components/operations/workspace";
import { logout } from "@/app/dashboard/actions";

export const instant = false;
export default async function ManagementPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  await connection();
  const { module: requested } = await params;
  if (!operationsModules.includes(requested as OperationsModule)) notFound();
  const selectedModule = requested as OperationsModule;
  const access = await getProductionAccess();
  if (access.status !== "ready")
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold">Acesso indisponível</h1>
        <p className="mt-4">
          Seu vínculo precisa estar ativo para operar o sistema.
        </p>
        <form action={logout}>
          <button className="btn btn-secondary mt-5">Sair</button>
        </form>
      </main>
    );
  const allowed =
    access.member.role === "admin"
      ? [...operationsModules]
      : access.member.role === "manager"
        ? ["staff", "time"]
        : ["time"];
  const authorized = allowed.includes(selectedModule);
  const { data, error } = authorized
    ? await access.supabase.rpc("operations_snapshot", {
        p_module: selectedModule,
      })
    : { data: null, error: { code: "42501" } };
  const snapshot = data as Snapshot | null;
  if (snapshot && access.member.role === "admin") {
    const [variants, categories] = await Promise.all([
      access.supabase
        .from("inventory_variants")
        .select("id,name,product_name,sku,unit_weight_kg")
        .eq("active", true)
        .eq("product_active", true)
        .eq("category_active", true)
        .order("product_name")
        .limit(1000),
      access.supabase
        .from("categories")
        .select("id,name")
        .eq("active", true)
        .order("name")
        .limit(1000),
    ]);
    snapshot.variants =
      variants.data?.map((row) => ({
        ...row,
        name: `${row.product_name} · ${row.name} · ${row.sku}`,
      })) ?? [];
    snapshot.categories = categories.data ?? [];
  }
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-7 sm:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link
          className="text-xl font-bold text-green-900"
          href={access.member.role === "admin" ? "/dashboard" : "/terminal"}
        >
          Frutalize
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm">{access.member.display_name}</span>
          <Link className="text-link" href="/terminal">
            Terminal
          </Link>
          <form action={logout}>
            <button className="btn btn-secondary">Sair</button>
          </form>
        </div>
      </header>
      <nav className="mb-8 flex flex-wrap gap-2" aria-label="Módulos de gestão">
        {allowed.map((item) => (
          <Link
            className={`btn ${item === selectedModule ? "btn-primary" : "btn-secondary"}`}
            href={`/gestao/${item}`}
            key={item}
          >
            {moduleNames[item as OperationsModule]}
          </Link>
        ))}
      </nav>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Gestão Frutalize</p>
          <h1>{moduleNames[selectedModule]}</h1>
          <p className="muted mt-2">
            Registros reais, vinculados à sua identidade e preservados no
            histórico.
          </p>
        </div>
      </div>
      {error || !snapshot ? (
        <div className="notice" role="alert">
          {error?.code === "42501"
            ? "Seu papel não permite consultar este módulo."
            : "O módulo está indisponível. Confira a conexão e a preparação do banco antes de operar."}
        </div>
      ) : (
        <OperationsWorkspace module={selectedModule} snapshot={snapshot} />
      )}
    </main>
  );
}
