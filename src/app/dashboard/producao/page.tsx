import Link from "next/link";
import { getAccess } from "@/lib/auth";
import { dateTime } from "@/lib/inventory/format";
import { productionStatusLabel } from "@/lib/production/status";
import {
  DataNotice,
  EmptyState,
  PageHeading,
  Panel,
} from "@/components/inventory/ui";

export const instant = false;

export default async function ProductionPage() {
  const access = await getAccess();
  if (access.status !== "ready") return null;
  const runsResult = await access.supabase
    .from("inventory_production_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(50);
  if (runsResult.error) return <DataNotice />;
  const runs = runsResult.data ?? [];
  const statusesResult = runs.length
    ? await access.supabase
        .from("production_runs")
        .select("id,operational_status")
        .in(
          "id",
          runs.map((run) => run.id),
        )
    : null;
  if (statusesResult?.error) return <DataNotice />;
  const statuses = new Map(
    (statusesResult?.data ?? []).map((run) => [run.id, run.operational_status]),
  );

  return (
    <>
      <PageHeading
        eyebrow="Dashboard administrativo"
        title="Produção"
        description="Acompanhe e opere ordens nesta visualização administrativa. O terminal oferece a rotina touch para a fábrica."
      >
        <Link
          className="btn btn-secondary"
          href="/dashboard/producao/configuracao"
        >
          Procedimentos e qualidade
        </Link>
        <Link className="btn btn-primary" href="/dashboard/producao/nova">
          Nova ordem
        </Link>
      </PageHeading>
      <Panel
        title="Ordens recentes"
        description="Últimas 50 ordens, da mais recente para a mais antiga."
      >
        {runs.length === 0 ? (
          <EmptyState
            title="Nenhuma ordem registrada"
            description="Crie uma ordem no dashboard ou no terminal para iniciar a produção."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <caption className="sr-only">Ordens de produção recentes</caption>
              <thead>
                <tr>
                  <th>Ordem</th>
                  <th>Situação</th>
                  <th>Início</th>
                  <th>Insumos</th>
                  <th>Saída</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <Link
                        className="text-link font-semibold"
                        href={`/dashboard/producao/${run.id}`}
                      >
                        {run.code}
                      </Link>
                    </td>
                    <td>
                      {productionStatusLabel(
                        statuses.get(run.id) ?? run.status,
                      )}
                    </td>
                    <td>{dateTime(run.started_at)}</td>
                    <td>{run.input_count}</td>
                    <td>{run.output_lot_code ?? "—"}</td>
                    <td>
                      <Link
                        className="text-link"
                        href={`/dashboard/producao/${run.id}`}
                      >
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
