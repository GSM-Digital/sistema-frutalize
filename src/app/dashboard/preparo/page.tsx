import Link from "next/link";
import { getAccess } from "@/lib/auth";
import { PreparationAdministration } from "@/components/production/preparation-administration";
import type { PreparationSnapshot } from "@/lib/preparation/types";

export const instant = false;

export default async function PreparationAdministrationPage() {
  const access = await getAccess();
  if (access.status !== "ready") return null;
  const { data, error } = await access.supabase.rpc("preparation_snapshot");
  if (error || !data || typeof data !== "object" || Array.isArray(data))
    return (
      <section className="notice">
        Não foi possível carregar o preparo de frutas. Verifique a atualização
        do banco.
      </section>
    );
  return (
    <main className="page-inset">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-title">Preparo de frutas</h1>
        <Link href="/terminal/preparo" className="btn btn-primary">
          Abrir terminal touch
        </Link>
      </div>
      <PreparationAdministration
        initial={data as unknown as PreparationSnapshot}
      />
    </main>
  );
}
