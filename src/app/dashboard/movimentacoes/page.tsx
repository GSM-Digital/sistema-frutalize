import Link from "next/link";
import { getAccess } from "@/lib/auth";
import { listParams } from "@/lib/inventory/validation";
import {
  movementKinds,
  type MovementKind,
  type SearchParams,
} from "@/lib/inventory/types";
import {
  DataNotice,
  EmptyState,
  MovementsTable,
  PageHeading,
  Pagination,
  Panel,
} from "@/components/inventory/ui";
export const instant = false;
export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await getAccess();
  if (access.status !== "ready") return null;
  const search = await searchParams;
  const { q, page, from, to, pattern } = listParams(search);
  const kind =
    typeof search.tipo === "string" && Object.hasOwn(movementKinds, search.tipo)
      ? (search.tipo as MovementKind)
      : "";
  let query = access.supabase
    .from("inventory_movements")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  if (q) query = query.ilike("search_text", pattern);
  if (kind) query = query.eq("kind", kind);
  const { data, error, count } = await query;
  if (error) return <DataNotice />;
  return (
    <>
      <PageHeading
        title="Movimentações"
        description="Entradas, saídas, perdas e conferências com motivo e responsável."
      >
        <Link className="btn btn-primary" href="/dashboard/lotes">
          Consultar lote para movimentar
        </Link>
      </PageHeading>
      <Panel
        title="Livro de movimentações"
        description="Ordenado pela data real do registro. Horários de Brasília."
      >
        <form
          className="filter-bar"
          action="/dashboard/movimentacoes"
          method="get"
        >
          <div className="filter-search">
            <label className="sr-only" htmlFor="movement-search">
              Buscar item, lote, responsável ou motivo
            </label>
            <input
              type="search"
              id="movement-search"
              name="q"
              defaultValue={q}
              maxLength={80}
              placeholder="Produto, lote, responsável ou motivo…"
            />
          </div>
          <label className="sr-only" htmlFor="movement-kind">
            Tipo de movimento
          </label>
          <select id="movement-kind" name="tipo" defaultValue={kind}>
            <option value="">Todos os tipos</option>
            {Object.entries(movementKinds).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary" type="submit">
            Filtrar
          </button>
          {(q || kind) && (
            <Link className="text-link text-sm" href="/dashboard/movimentacoes">
              Limpar
            </Link>
          )}
        </form>
        {data.length ? (
          <MovementsTable movements={data} />
        ) : (
          <EmptyState
            title="Nenhuma movimentação nesta consulta"
            description="Os registros aparecerão a partir do primeiro recebimento. Se houver filtros, tente ajustá-los."
          />
        )}
        <Pagination
          count={count ?? 0}
          page={page}
          path="/dashboard/movimentacoes"
          params={search}
        />
      </Panel>
    </>
  );
}
