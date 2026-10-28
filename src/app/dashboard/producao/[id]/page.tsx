import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccess } from "@/lib/auth";
import { dateTime, money, quantity } from "@/lib/inventory/format";
import { isUuid } from "@/lib/inventory/validation";
import { productionStatusLabel } from "@/lib/production/status";
import { DataNotice, PageHeading, Panel } from "@/components/inventory/ui";

export const instant = false;

export default async function ProductionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const access = await getAccess();
  if (access.status !== "ready") return null;
  const [runResult, inputsResult, statusResult] = await Promise.all([
    access.supabase
      .from("inventory_production_runs")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    access.supabase
      .from("inventory_production_inputs")
      .select("*")
      .eq("production_run_id", id)
      .order("created_at"),
    access.supabase
      .from("production_runs")
      .select("operational_status")
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (runResult.error || inputsResult.error || statusResult.error)
    return <DataNotice />;
  if (!runResult.data) notFound();
  const run = runResult.data;
  const inputs = inputsResult.data ?? [];
  const status = statusResult.data?.operational_status ?? run.status;

  return (
    <>
      <PageHeading
        eyebrow="Dashboard administrativo · Produção"
        title={`Ordem ${run.code}`}
        description="Consulta administrativa dos insumos, custo e lote de saída. A execução dos passos fica no terminal."
      >
        <Link className="btn btn-secondary" href="/dashboard/producao">
          Voltar às ordens
        </Link>
      </PageHeading>
      <Panel title="Resumo da ordem">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="muted text-sm">Situação</dt>
            <dd className="font-semibold">{productionStatusLabel(status)}</dd>
          </div>
          <div>
            <dt className="muted text-sm">Iniciada em</dt>
            <dd>{dateTime(run.started_at)}</dd>
          </div>
          <div>
            <dt className="muted text-sm">Concluída em</dt>
            <dd>{run.completed_at ? dateTime(run.completed_at) : "—"}</dd>
          </div>
          <div>
            <dt className="muted text-sm">Insumos</dt>
            <dd>{run.input_count}</dd>
          </div>
          <div>
            <dt className="muted text-sm">Custo dos insumos</dt>
            <dd>{money(run.total_input_cost)}</dd>
          </div>
          <div>
            <dt className="muted text-sm">Lote produzido</dt>
            <dd>{run.output_lot_code ?? "—"}</dd>
          </div>
          {run.output_quantity != null && (
            <div>
              <dt className="muted text-sm">Quantidade produzida</dt>
              <dd>
                {quantity(run.output_quantity, run.output_unit ?? undefined)}
              </dd>
            </div>
          )}
        </dl>
      </Panel>
      <Panel title="Insumos consumidos">
        {inputs.length === 0 ? (
          <p className="muted text-sm">Nenhum insumo consumido até agora.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <caption className="sr-only">Insumos consumidos na ordem</caption>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Lote de origem</th>
                  <th>Quantidade</th>
                  <th>Custo</th>
                </tr>
              </thead>
              <tbody>
                {inputs.map((input) => (
                  <tr key={input.id}>
                    <td>
                      {input.product_name}
                      {input.is_default ? "" : ` · ${input.variant_name}`}
                    </td>
                    <td>{input.source_lot_code}</td>
                    <td>{quantity(input.quantity, input.unit)}</td>
                    <td>{money(input.input_cost)}</td>
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
