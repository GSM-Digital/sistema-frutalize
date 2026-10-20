import Link from "next/link";
import { notFound } from "next/navigation";
import { CompleteProductionForm } from "@/components/inventory/forms";
import { DataNotice, PageHeading, Panel } from "@/components/inventory/ui";
import { getAccess } from "@/lib/auth";
import { dateTime, money, quantity } from "@/lib/inventory/format";
import { businessDateTime, isUuid } from "@/lib/inventory/validation";

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
  const [runResult, inputsResult, variantsResult, locationsResult] =
    await Promise.all([
      access.supabase
        .from("inventory_production_runs")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      access.supabase
        .from("inventory_production_inputs")
        .select("*")
        .eq("production_run_id", id)
        .order("created_at")
        .order("id"),
      access.supabase
        .from("inventory_variants")
        .select("*")
        .eq("category_name", "Polpas prontas")
        .eq("active", true)
        .eq("product_active", true)
        .eq("category_active", true)
        .order("product_name")
        .order("name"),
      access.supabase
        .from("storage_locations")
        .select("*")
        .eq("active", true)
        .ilike("name", "Freezer %")
        .order("name"),
    ]);
  if (
    runResult.error ||
    inputsResult.error ||
    variantsResult.error ||
    locationsResult.error
  )
    return <DataNotice />;
  if (!runResult.data) notFound();
  const run = runResult.data;
  return (
    <>
      <PageHeading
        eyebrow="Produção"
        title={run.code}
        description={
          run.status === "in_progress"
            ? "Insumos retirados do estoque e aguardando a finalização da polpa."
            : "Produção finalizada com rastreabilidade entre entrada e produto congelado."
        }
      >
        <Link className="btn btn-secondary" href="/dashboard/producao">
          Voltar às produções
        </Link>
      </PageHeading>
      <Panel title="Insumos desta produção">
        <ul className="production-input-list">
          {inputsResult.data.map((input) => (
            <li key={input.id}>
              <div>
                <Link
                  className="text-link"
                  href={`/dashboard/lotes/${input.source_lot_id}`}
                >
                  {input.product_name}
                </Link>
                <span className="table-sub">
                  {!input.is_default && `${input.variant_name} · `}
                  {input.source_lot_code}
                </span>
              </div>
              <strong>{quantity(input.quantity, input.unit)}</strong>
              <span>{money(input.input_cost)}</span>
            </li>
          ))}
        </ul>
        <dl className="production-summary">
          <div>
            <dt>Início</dt>
            <dd>{dateTime(run.started_at)}</dd>
          </div>
          <div>
            <dt>Custo dos insumos</dt>
            <dd>{money(run.total_input_cost)}</dd>
          </div>
          <div>
            <dt>Situação</dt>
            <dd>
              {run.status === "in_progress" ? "Em produção" : "Finalizada"}
            </dd>
          </div>
        </dl>
      </Panel>
      <div className="mt-6">
        {run.status === "in_progress" ? (
          <Panel
            title="Finalizar e armazenar a polpa"
            description="Informe o rendimento final e o freezer onde o novo lote ficará."
          >
            <div className="p-5 sm:p-6">
              {variantsResult.data.length && locationsResult.data.length ? (
                <CompleteProductionForm
                  productionId={run.id}
                  requestId={crypto.randomUUID()}
                  now={businessDateTime()}
                  variants={variantsResult.data}
                  locations={locationsResult.data}
                />
              ) : (
                <div className="notice" role="alert">
                  Cadastre uma polpa pronta ativa e mantenha ao menos um freezer
                  ativo antes de finalizar esta produção.
                </div>
              )}
            </div>
          </Panel>
        ) : (
          <Panel
            title="Lote congelado gerado"
            description="O produto final já está disponível no estoque."
          >
            <div className="p-5 sm:p-6">
              <p className="text-sm leading-7">
                {run.output_product_name}
                {!run.output_is_default && run.output_variant_name
                  ? ` · ${run.output_variant_name}`
                  : ""}
                {run.output_quantity !== null && run.output_unit
                  ? ` — ${quantity(run.output_quantity, run.output_unit)}`
                  : ""}
                {run.output_location_name
                  ? ` — ${run.output_location_name}`
                  : ""}
              </p>
              {run.output_lot_id && (
                <Link
                  className="btn btn-primary mt-4"
                  href={`/dashboard/lotes/${run.output_lot_id}`}
                >
                  Abrir lote produzido
                </Link>
              )}
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
