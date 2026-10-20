import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccess } from "@/lib/auth";
import { catalogs, isCatalogSlug } from "@/lib/inventory/catalog";
import { catalogOptions } from "@/lib/inventory/queries";
import { isUuid, listParams } from "@/lib/inventory/validation";
import { quantity } from "@/lib/inventory/format";
import type { CatalogRecord, SearchParams } from "@/lib/inventory/types";
import { CatalogForm } from "@/components/inventory/forms";
import {
  DataNotice,
  EmptyState,
  PageHeading,
  Pagination,
  Panel,
} from "@/components/inventory/ui";
export const instant = false;
export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { tipo } = await params;
  if (!isCatalogSlug(tipo)) notFound();
  const access = await getAccess();
  if (access.status !== "ready") return null;
  const config = catalogs[tipo];
  const search = await searchParams;
  const { q, page, from, to, pattern } = listParams(search);
  const path = `/dashboard/cadastros/${tipo}`;
  let query = access.supabase
    .from(config.table)
    .select("*", { count: "exact" })
    .order("name")
    .order("id")
    .range(from, to);
  if (q) query = query.ilike("name", pattern);
  const [result, optionsResult] = await Promise.all([
    query,
    catalogOptions(access.supabase)
      .then((data) => ({ data, error: null }))
      .catch(() => ({ data: null, error: true })),
  ]);
  if (result.error || optionsResult.error || !optionsResult.data)
    return <DataNotice />;
  const options = optionsResult.data;
  const rows = result.data as CatalogRecord[];
  let record: CatalogRecord | undefined;
  if (typeof search.editar === "string") {
    if (!isUuid(search.editar)) notFound();
    const selected = await access.supabase
      .from(config.table)
      .select("*")
      .eq("id", search.editar)
      .maybeSingle();
    if (selected.error) return <DataNotice />;
    if (!selected.data) notFound();
    record = selected.data as CatalogRecord;
  }
  const showForm = search.novo === "1" || Boolean(record);
  const nameFor = (key: string, id: unknown) =>
    (key === "category_id" ? options.categories : options.products).find(
      (x) => x.id === id,
    )?.name ?? "—";
  return (
    <>
      <PageHeading
        eyebrow="Cadastros"
        title={config.title}
        description={config.description}
      >
        <div className="flex flex-wrap gap-2">
          {tipo === "produtos" && (
            <Link
              href="/dashboard/cadastros/apresentacoes"
              className="btn btn-secondary"
            >
              Tamanhos e embalagens
            </Link>
          )}
          <Link href={`${path}?novo=1`} className="btn btn-primary">
            ＋ Novo cadastro
          </Link>
        </div>
      </PageHeading>
      {showForm && (
        <div className="mb-6">
          <Panel
            title={
              record
                ? `Editar ${config.singular}`
                : `Cadastrar ${config.singular}`
            }
            description="Campos com * são obrigatórios. Alterações preservam o histórico."
          >
            <div className="p-5 sm:p-6">
              <CatalogForm
                key={record?.id ?? `new-${tipo}`}
                entity={config.entity}
                record={record}
                options={options}
                skuSuggestion={`FRU-${crypto.randomUUID().slice(0, 8).toUpperCase()}`}
                cancelHref={path}
              />
            </div>
          </Panel>
        </div>
      )}
      <Panel
        title="Cadastros da fábrica"
        description="Consulte, edite ou arquive sem apagar registros anteriores."
      >
        <form className="filter-bar" method="get" action={path}>
          <div className="filter-search">
            <label className="sr-only" htmlFor="catalog-search">
              Buscar por nome
            </label>
            <input
              id="catalog-search"
              type="search"
              name="q"
              defaultValue={q}
              maxLength={80}
              placeholder="Buscar por nome…"
            />
          </div>
          <button className="btn btn-secondary" type="submit">
            Buscar
          </button>
          {q && (
            <Link className="text-link text-sm" href={path}>
              Limpar
            </Link>
          )}
        </form>
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <caption className="sr-only">{config.title} cadastrados</caption>
              <thead>
                <tr>
                  <th>Identificação</th>
                  <th>Detalhes</th>
                  <th>Situação</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold">
                      {row.name}
                      {typeof row.sku === "string" && (
                        <span className="table-sub font-mono">{row.sku}</span>
                      )}
                    </td>
                    <td>
                      {config.entity === "products" ? (
                        <>
                          {nameFor("category_id", row.category_id)}
                          <span className="table-sub">
                            {row.requires_expiry
                              ? "Exige validade"
                              : "Validade opcional"}
                          </span>
                        </>
                      ) : config.entity === "variants" ? (
                        <>
                          {nameFor("product_id", row.product_id)}
                          <span className="table-sub">
                            {typeof row.unit_weight_kg === "number"
                              ? `${quantity(row.unit_weight_kg, "kg")} por unidade`
                              : "Peso unitário não definido"}
                          </span>
                        </>
                      ) : config.entity === "suppliers" ? (
                        <>
                          {String(row.cnpj || "CNPJ não informado")}
                          <span className="table-sub">
                            {String(row.contact_name || row.phone || "—")}
                          </span>
                        </>
                      ) : (
                        String(row.description || "—")
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${row.active ? "badge-green" : ""}`}
                      >
                        {row.active ? "Ativo" : "Arquivado"}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="text-link"
                        aria-label={`Editar ${row.name}`}
                        href={`${path}?editar=${row.id}`}
                      >
                        Editar →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={
              q
                ? "Nenhum cadastro encontrado"
                : "Comece pelos dados da operação"
            }
            description={
              q
                ? "Tente outro nome ou limpe a busca."
                : `Cadastre ${config.singular} para preparar o controle de estoque.`
            }
            href={q ? path : `${path}?novo=1`}
            label={q ? "Limpar busca" : "Novo cadastro"}
          />
        )}
        <Pagination
          count={result.count ?? 0}
          page={page}
          path={path}
          params={search}
        />
      </Panel>
    </>
  );
}
