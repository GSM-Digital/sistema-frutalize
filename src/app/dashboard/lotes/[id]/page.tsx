import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccess } from "@/lib/auth";
import {
  businessDate,
  businessDateTime,
  isUuid,
  listParams,
} from "@/lib/inventory/validation";
import { dateTime, money, quantity, shortDate } from "@/lib/inventory/format";
import type { SearchParams } from "@/lib/inventory/types";
import { MovementForm, StatusForm } from "@/components/inventory/forms";
import {
  DataNotice,
  LotBadge,
  MovementsTable,
  PageHeading,
  Pagination,
  Panel,
} from "@/components/inventory/ui";
export const instant = false;
export default async function LotPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const access = await getAccess();
  if (access.status !== "ready") return null;
  const search = await searchParams;
  const { page, from, to } = listParams(search);
  const [lotResult, movements] = await Promise.all([
    access.supabase
      .from("inventory_lots")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    access.supabase
      .from("inventory_movements")
      .select("*", { count: "exact" })
      .eq("lot_id", id)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  ]);
  if (lotResult.error || movements.error) return <DataNotice />;
  if (!lotResult.data) notFound();
  const lot = lotResult.data;
  const today = businessDate();
  const now = businessDateTime();
  const details = [
    ["Apresentação", `${lot.variant_name} · ${lot.sku}`],
    ["Local físico", lot.location_name],
    ["Fornecedor", lot.supplier_name],
    ["Documento", lot.reference],
    ["Lote do fornecedor", lot.supplier_lot || "Não informado"],
    ["Recebimento", dateTime(lot.received_at)],
    [
      "Fabricação",
      lot.manufactured_on ? shortDate(lot.manufactured_on) : "Não informada",
    ],
    ["Validade", lot.expires_on ? shortDate(lot.expires_on) : "Não se aplica"],
    [
      "Origem da validade",
      lot.expiry_source === "supplier"
        ? "Fornecedor"
        : lot.expiry_source === "internal"
          ? "Definida internamente"
          : "Não se aplica",
    ],
    ["Quantidade recebida", quantity(lot.initial_quantity, lot.unit)],
    [
      "Peso líquido recebido",
      lot.initial_weight_kg === null
        ? "Não informado"
        : quantity(lot.initial_weight_kg, "kg"),
    ],
    ["Preço total de entrada", money(lot.total_cost)],
    [`Custo por ${lot.unit}`, money(lot.unit_cost, 6)],
    ["Registro real", dateTime(lot.created_at)],
  ];
  return (
    <>
      <PageHeading
        eyebrow="Detalhes do lote"
        title={lot.product_name}
        description={`Lote interno ${lot.code}`}
      >
        <Link className="btn btn-secondary" href="/dashboard/lotes">
          Voltar ao estoque
        </Link>
      </PageHeading>
      <div className="lot-summary">
        <div>
          <p className="muted text-sm">Saldo atual</p>
          <strong>{quantity(lot.quantity, lot.unit)}</strong>
          {lot.remaining_weight_kg !== null && (
            <p className="muted text-sm mt-1">
              Peso proporcional ao recebido:{" "}
              {quantity(lot.remaining_weight_kg, "kg")}
            </p>
          )}
        </div>
        <LotBadge lot={lot} today={today} />
      </div>
      <Panel title="Rastreabilidade da entrada">
        <dl className="details-grid">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-[#dfe6dc] p-5 sm:p-6">
          <h3 className="text-sm font-semibold">Inspeção de qualidade</h3>
          <p className="muted mt-2 text-sm whitespace-pre-wrap leading-6">
            {lot.inspection_notes}
          </p>
        </div>
      </Panel>
      <div className="grid gap-6 mt-6 xl:grid-cols-2">
        <Panel
          title="Registrar saída ou perda"
          description="O saldo é validado no momento da gravação."
        >
          <div className="p-5 sm:p-6">
            <MovementForm
              lot={lot}
              requestId={crypto.randomUUID()}
              now={now}
              today={today}
            />
          </div>
        </Panel>
        <Panel
          title="Conferir situação do lote"
          description="Registre a liberação, o bloqueio ou o retorno à quarentena."
        >
          <div className="p-5 sm:p-6">
            <StatusForm
              lot={lot}
              requestId={crypto.randomUUID()}
              today={today}
            />
          </div>
        </Panel>
      </div>
      <div className="mt-6">
        <Panel
          title="Histórico deste lote"
          description="A data operacional e a data real de cada registro são mantidas separadamente."
        >
          <MovementsTable movements={movements.data} />
          <Pagination
            count={movements.count ?? 0}
            page={page}
            path={`/dashboard/lotes/${id}`}
            params={search}
          />
        </Panel>
      </div>
    </>
  );
}
