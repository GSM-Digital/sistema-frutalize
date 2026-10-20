import { getAccess } from "@/lib/auth";
import { dateTime } from "@/lib/inventory/format";
import { catalogOptions } from "@/lib/inventory/queries";
import { listParams } from "@/lib/inventory/validation";
import type { CatalogOptions, Json, SearchParams } from "@/lib/inventory/types";
import {
  DataNotice,
  EmptyState,
  PageHeading,
  Pagination,
  Panel,
} from "@/components/inventory/ui";
export const instant = false;
const entities: Record<string, string> = {
  categories: "Categoria",
  products: "Item",
  receipts: "Recebimento",
  item_variants: "Tamanho/embalagem",
  suppliers: "Fornecedor",
  storage_locations: "Local de estoque",
};
const labels: Record<string, string> = {
  name: "Nome",
  active: "Situação",
  category_id: "Categoria",
  product_id: "Item principal",
  sku: "SKU",
  unit_weight_kg: "Peso unitário (kg)",
  requires_expiry: "Controle de validade",
  has_variants: "Tamanhos/embalagens separados",
  cnpj: "CNPJ",
  phone: "Telefone",
  address: "Endereço",
  contact_name: "Contato",
  description: "Descrição",
};
function Snapshot({ data, options }: { data: Json; options: CatalogOptions }) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    return <p className="muted text-xs">Registro ainda não existia.</p>;
  return (
    <dl className="audit-snapshot">
      {Object.entries(data)
        .filter(([key]) => labels[key])
        .map(([key, value]) => {
          const formatted =
            key === "active"
              ? value
                ? "Ativo"
                : "Arquivado"
              : key === "requires_expiry"
                ? value
                  ? "Obrigatória"
                  : "Opcional"
                : key === "has_variants"
                  ? value
                    ? "Sim"
                    : "Não, entrada direta"
                  : key === "category_id"
                    ? options.categories.find((x) => x.id === value)?.name
                    : key === "product_id"
                      ? options.products.find((x) => x.id === value)?.name
                      : value;
          return (
            <div key={key}>
              <dt>{labels[key]}</dt>
              <dd>
                {formatted === null ||
                formatted === "" ||
                formatted === undefined
                  ? "Não informado"
                  : String(formatted)}
              </dd>
            </div>
          );
        })}
    </dl>
  );
}
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await getAccess();
  if (access.status !== "ready") return null;
  const search = await searchParams;
  const { page, from, to } = listParams(search);
  const { data, error, count } = await access.supabase
    .from("audit_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  if (error) return <DataNotice />;
  const options = await catalogOptions(access.supabase).catch(() => null);
  if (!options) return <DataNotice />;
  return (
    <>
      <PageHeading
        eyebrow="Auditoria"
        title="Histórico de alterações"
        description="Quem alterou os cadastros, quando e por qual motivo."
      />
      <Panel
        title="Registros preservados"
        description="Consulte os dados anteriores e os dados salvos em cada alteração."
      >
        {data.length ? (
          <div className="audit-list">
            {data.map((event) => (
              <article key={event.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3>
                      {entities[event.entity] ?? event.entity} ·{" "}
                      {event.action === "INSERT" ? "Cadastro" : "Alteração"}
                    </h3>
                    <p className="muted mt-1 text-xs">
                      {event.actor_name} · {dateTime(event.created_at)}
                    </p>
                  </div>
                  <span className="badge">
                    {event.action === "INSERT"
                      ? "Novo registro"
                      : "Dados atualizados"}
                  </span>
                </div>
                <p className="mt-3 text-sm">{event.reason}</p>
                <details className="audit-details">
                  <summary>Consultar dados do registro</summary>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <h4>Antes</h4>
                      <Snapshot data={event.before_data} options={options} />
                    </div>
                    <div>
                      <h4>Depois</h4>
                      <Snapshot data={event.after_data} options={options} />
                    </div>
                  </div>
                </details>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhuma alteração registrada"
            description="O histórico será criado automaticamente ao salvar os primeiros cadastros."
          />
        )}
        <Pagination
          count={count ?? 0}
          page={page}
          path="/dashboard/historico"
          params={search}
        />
      </Panel>
    </>
  );
}
