import Link from "next/link";
import { getAccess } from "@/lib/auth";
import { DataNotice, PageHeading } from "@/components/inventory/ui";
import { DashboardOperations } from "@/components/production/dashboard-operations";
import { terminalSnapshot } from "@/lib/production/ui-types";
import { isUuid } from "@/lib/inventory/validation";
import type { SearchParams } from "@/lib/inventory/types";

export const instant = false;

export default async function NewProductionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await getAccess();
  if (access.status !== "ready") return null;
  const { data, error } = await access.supabase.rpc(
    "production_terminal_snapshot",
  );
  if (error || !data) return <DataNotice />;
  const snapshot = terminalSnapshot(data);
  const raw = (await searchParams).lotes;
  const selectedLotIds = typeof raw === "string" ? raw.split(",") : [];
  const selectedLots = selectedLotIds.map((id) =>
    snapshot.lots.find((lot) => lot.id === id),
  );
  const invalidSelection =
    selectedLotIds.length > 25 ||
    new Set(selectedLotIds).size !== selectedLotIds.length ||
    selectedLotIds.some((id) => !isUuid(id)) ||
    selectedLots.some((lot) => !lot) ||
    selectedLots.some((lot) => lot?.product_id !== selectedLots[0]?.product_id);
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
      {invalidSelection ? (
        <div className="notice" role="alert">
          A seleção de lotes mudou ou não está disponível para uma mesma fruta.
          Volte ao estoque e selecione novamente.
          <Link className="text-link ml-2" href="/dashboard/lotes">
            Voltar ao estoque
          </Link>
        </div>
      ) : (
        <DashboardOperations
          initial={snapshot}
          selectedLotIds={selectedLotIds}
        />
      )}
    </>
  );
}
