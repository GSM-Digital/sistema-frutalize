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

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string }>;
}) {
  const { visao } = await searchParams;
  const selectedView = ["ativas", "finalizadas", "todas"].includes(visao ?? "")
    ? visao
    : "ativas";
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
  const isActive = (run: (typeof runs)[number]) =>
    run.status !== "completed" && statuses.get(run.id) !== "cancelled";
  const visibleRuns = runs.filter((run) =>
    selectedView === "todas"
      ? true
      : selectedView === "ativas"
        ? isActive(run)
        : !isActive(run),
  );
  const views = [
    {
      key: "ativas",
      label: "Em andamento",
      count: runs.filter(isActive).length,
    },
    {
      key: "finalizadas",
      label: "Encerradas",
      count: runs.filter((run) => !isActive(run)).length,
    },
    { key: "todas", label: "Todas", count: runs.length },
  ];

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
      <nav
        className="production-view-tabs flex flex-wrap gap-2"
        aria-label="Filtrar ordens de produção"
      >
        {views.map((view) => (
          <Link
            key={view.key}
            href={`/dashboard/producao?visao=${view.key}`}
            aria-current={selectedView === view.key ? "page" : undefined}
            className={`btn ${selectedView === view.key ? "btn-primary" : "btn-secondary"}`}
          >
            {view.label} <span className="ml-1 opacity-70">{view.count}</span>
          </Link>
        ))}
      </nav>
      <Panel
        title="Ordens recentes"
        description="Contagem e lista das últimas 50 ordens, da mais recente para a mais antiga."
      >
        {visibleRuns.length === 0 ? (
          <EmptyState
            title={
              runs.length === 0
                ? "Nenhuma ordem registrada"
                : "Nenhuma ordem nesta aba"
            }
            description={
              runs.length === 0
                ? "Crie uma ordem no dashboard ou no terminal para iniciar a produção."
                : "Consulte outra aba para ver as ordens recentes."
            }
          />
        ) : (
          <>
            <ul
              className="production-mobile-list"
              aria-label="Ordens de produção recentes"
            >
              {visibleRuns.map((run) => (
                <li className="production-mobile-card" key={run.id}>
                  <div className="production-mobile-card-heading">
                    <div>
                      <span className="eyebrow">Ordem de produção</span>
                      <h3>{run.code}</h3>
                    </div>
                    <span
                      className="production-mobile-status"
                      data-status={statuses.get(run.id) ?? run.status}
                    >
                      {productionStatusLabel(
                        statuses.get(run.id) ?? run.status,
                      )}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Início</dt>
                      <dd>{dateTime(run.started_at)}</dd>
                    </div>
                    <div>
                      <dt>Insumos</dt>
                      <dd>{run.input_count}</dd>
                    </div>
                    <div>
                      <dt>Lote produzido</dt>
                      <dd>{run.output_lot_code ?? "Ainda não registrado"}</dd>
                    </div>
                  </dl>
                  <Link
                    className="btn btn-secondary production-mobile-card-action"
                    href={`/dashboard/producao/${run.id}`}
                  >
                    Abrir ordem <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="table-scroll production-desktop-table">
              <table>
                <caption className="sr-only">
                  Ordens de produção recentes
                </caption>
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
                  {visibleRuns.map((run) => (
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
          </>
        )}
      </Panel>
    </>
  );
}
