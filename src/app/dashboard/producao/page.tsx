import Link from "next/link";
import { getAccess } from "@/lib/auth";
import { dateTime, money } from "@/lib/inventory/format";
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
  const { data, error } = await access.supabase
    .from("inventory_production_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id");
  if (error) return <DataNotice />;
  return (
    <>
      <PageHeading
        eyebrow="Produção"
        title="Linha de produção"
        description="Acompanhe os insumos enviados e transforme cada processo em um lote de polpa congelada."
      >
        <Link className="btn btn-secondary" href="/dashboard/lotes">
          Selecionar item do estoque
        </Link>
      </PageHeading>
      <Panel
        title="Processos de produção"
        description="Produções em andamento aparecem primeiro para facilitar a finalização."
      >
        {data.length ? (
          <ul className="production-list">
            {[...data]
              .sort((a, b) =>
                a.status === b.status ? 0 : a.status === "in_progress" ? -1 : 1,
              )
              .map((run) => (
                <li key={run.id} className="production-card">
                  <div>
                    <span
                      className={`badge ${run.status === "in_progress" ? "badge-amber" : "badge-green"}`}
                    >
                      {run.status === "in_progress"
                        ? "Em produção"
                        : "Finalizada"}
                    </span>
                    <h3>{run.code}</h3>
                    <p>{run.input_summary}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>Início</dt>
                      <dd>{dateTime(run.started_at)}</dd>
                    </div>
                    <div>
                      <dt>Custo dos insumos</dt>
                      <dd>{money(run.total_input_cost)}</dd>
                    </div>
                  </dl>
                  <Link
                    className="btn btn-secondary"
                    href={`/dashboard/producao/${run.id}`}
                  >
                    {run.status === "in_progress"
                      ? "Continuar produção"
                      : "Consultar produção"}
                  </Link>
                </li>
              ))}
          </ul>
        ) : (
          <EmptyState
            title="Nenhuma produção iniciada"
            description="Abra um lote com saldo no estoque e escolha Enviar para produção."
            href="/dashboard/lotes"
            label="Abrir estoque"
          />
        )}
      </Panel>
    </>
  );
}
