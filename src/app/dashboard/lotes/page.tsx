import Link from "next/link";
import { getAccess } from "@/lib/auth";
import { addDays, businessDate, listParams } from "@/lib/inventory/validation";
import {
  statuses,
  type LotStatus,
  type SearchParams,
} from "@/lib/inventory/types";
import {
  DataNotice,
  EmptyState,
  LotsTable,
  PageHeading,
  Pagination,
  Panel,
} from "@/components/inventory/ui";
export const instant = false;
export default async function LotsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await getAccess();
  if (access.status !== "ready") return null;
  const search = await searchParams;
  const { q, page, from, to, pattern } = listParams(search);
  const today = businessDate();
  const status =
    typeof search.status === "string" && Object.hasOwn(statuses, search.status)
      ? (search.status as LotStatus)
      : "";
  const expiry =
    search.validade === "proximos" || search.validade === "vencidos"
      ? search.validade
      : "";
  const includeEmpty = search.zerados === "1";
  let query = access.supabase
    .from("inventory_lots")
    .select("*", { count: "exact" })
    .order("expires_on", { ascending: true, nullsFirst: false })
    .order("created_at")
    .order("id")
    .range(from, to);
  if (q) query = query.ilike("search_text", pattern);
  if (status) query = query.eq("status", status);
  if (!includeEmpty) query = query.gt("quantity", 0);
  if (expiry === "proximos")
    query = query
      .gte("expires_on", today)
      .lte("expires_on", addDays(today, 30));
  if (expiry === "vencidos") query = query.lt("expires_on", today);
  const { data, error, count } = await query;
  if (error) return <DataNotice />;
  return (
    <>
      <PageHeading
        title="Estoque e lotes"
        description="Saldos por tamanho/embalagem e local. Os lotes com menor validade aparecem primeiro."
      >
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-secondary" href="/dashboard/movimentacoes">
            Ver movimentações
          </Link>
          <Link className="btn btn-primary" href="/dashboard/recebimentos/novo">
            ＋ Novo recebimento
          </Link>
        </div>
      </PageHeading>
      <Panel
        title="Posição do estoque"
        description="Cada saldo mantém a unidade informada no recebimento."
      >
        <form className="filter-bar" action="/dashboard/lotes" method="get">
          <div className="filter-search">
            <label htmlFor="lot-search" className="sr-only">
              Buscar produto, SKU, lote, fornecedor ou local
            </label>
            <input
              id="lot-search"
              name="q"
              defaultValue={q}
              type="search"
              maxLength={80}
              placeholder="Produto, SKU, lote, fornecedor ou local…"
            />
          </div>
          <div>
            <label htmlFor="lot-status" className="sr-only">
              Situação
            </label>
            <select name="status" id="lot-status" defaultValue={status}>
              <option value="">Todas as situações</option>
              {Object.entries(statuses).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lot-expiry" className="sr-only">
              Validade
            </label>
            <select name="validade" id="lot-expiry" defaultValue={expiry}>
              <option value="">Todas as validades</option>
              <option value="proximos">Vencem em até 30 dias</option>
              <option value="vencidos">Vencidos</option>
            </select>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              name="zerados"
              value="1"
              defaultChecked={includeEmpty}
            />
            Incluir sem saldo
          </label>
          <button className="btn btn-secondary" type="submit">
            Filtrar
          </button>
          {(q || status || expiry || includeEmpty) && (
            <Link className="text-link text-sm" href="/dashboard/lotes">
              Limpar
            </Link>
          )}
        </form>
        {data.length ? (
          <LotsTable lots={data} today={today} />
        ) : (
          <EmptyState
            title="Nenhum lote nesta consulta"
            description="Ajuste os filtros ou registre um recebimento para começar."
            href="/dashboard/recebimentos/novo"
            label="Novo recebimento"
          />
        )}
        <Pagination
          count={count ?? 0}
          page={page}
          path="/dashboard/lotes"
          params={search}
        />
      </Panel>
    </>
  );
}
