import Link from "next/link";
import { getAccess } from "@/lib/auth";
import { DataNotice, PageHeading } from "@/components/inventory/ui";
import { DashboardOperations } from "@/components/production/dashboard-operations";
import { terminalSnapshot } from "@/lib/production/ui-types";

export const instant = false;

export default async function NewProductionPage() {
  const access = await getAccess();
  if (access.status !== "ready") return null;
  const { data, error } = await access.supabase.rpc(
    "production_terminal_snapshot",
  );
  if (error || !data) return <DataNotice />;
  return (
    <>
      <PageHeading
        eyebrow="Dashboard administrativo · Produção"
        title="Nova ordem"
        description="Selecione procedimento, perfil, regra de qualidade e lotes de origem para criar a ordem no dashboard."
      >
        <Link className="btn btn-secondary" href="/dashboard/producao">
          Voltar às ordens
        </Link>
      </PageHeading>
      <DashboardOperations initial={terminalSnapshot(data)} />
    </>
  );
}
