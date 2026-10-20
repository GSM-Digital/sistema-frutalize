import Link from "next/link";
import type {
  InventoryLot,
  InventoryMovement,
  SearchParams,
} from "@/lib/inventory/types";
import { movementKinds, statuses } from "@/lib/inventory/types";
import { dateTime, quantity, shortDate } from "@/lib/inventory/format";

export function PageHeading({
  eyebrow = "Gestão de estoque",
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted mt-2 max-w-2xl text-sm leading-6 sm:text-base">
          {description}
        </p>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
export function Panel({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description && (
            <p className="muted mt-1 text-sm leading-6">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function EmptyState({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <span aria-hidden="true" className="empty-mark">
        ↗
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {href && (
        <Link className="btn btn-secondary mt-5" href={href}>
          {label}
        </Link>
      )}
    </div>
  );
}
export function DataNotice() {
  return (
    <div className="notice" role="alert">
      <h2 className="font-semibold">Não foi possível consultar o estoque</h2>
      <p className="mt-2 text-sm leading-6">
        Os dados estão temporariamente indisponíveis. Atualize a página ou entre
        em contato com o administrador.
      </p>
      <Link className="text-link mt-3 inline-block" href="/dashboard">
        Voltar à visão geral
      </Link>
    </div>
  );
}
export function LotBadge({
  lot,
  today,
}: {
  lot: Pick<InventoryLot, "quantity" | "expires_on" | "status">;
  today: string;
}) {
  if (lot.quantity === 0) return <span className="badge">Sem saldo</span>;
  if (lot.expires_on && lot.expires_on < today)
    return <span className="badge badge-danger">Vencido</span>;
  return (
    <span
      className={`badge ${lot.status === "released" ? "badge-green" : lot.status === "blocked" ? "badge-danger" : "badge-amber"}`}
    >
      {statuses[lot.status]}
    </span>
  );
}
export function LotsTable({
  lots,
  today,
}: {
  lots: InventoryLot[];
  today: string;
}) {
  return (
    <div className="table-scroll">
      <table>
        <caption className="sr-only">
          Lotes por tamanho/embalagem e local de armazenamento
        </caption>
        <thead>
          <tr>
            <th>Produto / lote</th>
            <th>Local</th>
            <th>Saldo</th>
            <th>Validade</th>
            <th>Situação</th>
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => (
            <tr key={lot.id}>
              <td>
                <Link className="text-link" href={`/dashboard/lotes/${lot.id}`}>
                  {lot.product_name}
                </Link>
                <span className="table-sub">
                  {lot.variant_name} · {lot.sku}
                </span>
                <span className="table-sub font-mono">{lot.code}</span>
              </td>
              <td>{lot.location_name}</td>
              <td className="tabular-nums whitespace-nowrap font-semibold">
                {quantity(lot.quantity, lot.unit)}
              </td>
              <td className="whitespace-nowrap">
                {lot.expires_on ? shortDate(lot.expires_on) : "Não se aplica"}
              </td>
              <td>
                <LotBadge lot={lot} today={today} />
              </td>
              <td>
                <Link
                  className="text-link whitespace-nowrap"
                  href={`/dashboard/lotes/${lot.id}`}
                  aria-label={`Consultar lote ${lot.code}`}
                >
                  Abrir →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function MovementsTable({
  movements,
}: {
  movements: InventoryMovement[];
}) {
  return (
    <div className="table-scroll">
      <table>
        <caption className="sr-only">
          Histórico de movimentações do estoque
        </caption>
        <thead>
          <tr>
            <th>Movimentação</th>
            <th>Produto / lote</th>
            <th>Quantidade</th>
            <th>Responsável</th>
            <th>Registro</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id}>
              <td>
                <span
                  className={`badge ${m.kind === "receipt" ? "badge-green" : m.kind === "loss" ? "badge-danger" : ""}`}
                >
                  {movementKinds[m.kind]}
                </span>
                <span className="table-sub max-w-64">{m.reason}</span>
              </td>
              <td>
                <Link
                  className="text-link"
                  href={`/dashboard/lotes/${m.lot_id}`}
                >
                  {m.product_name}
                </Link>
                <span className="table-sub">
                  {m.variant_name} · {m.lot_code}
                </span>
              </td>
              <td className="whitespace-nowrap tabular-nums">
                {m.quantity > 0 ? "+" : ""}
                {quantity(m.quantity, m.unit)}
                <span className="table-sub">
                  Saldo: {quantity(m.balance_after, m.unit)}
                </span>
              </td>
              <td>{m.actor_name}</td>
              <td className="whitespace-nowrap text-xs leading-5">
                {dateTime(m.created_at)}
                <span className="table-sub">
                  Operação: {dateTime(m.operated_at)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Pagination({
  count,
  page,
  path,
  params,
}: {
  count: number;
  page: number;
  path: string;
  params: SearchParams;
}) {
  const pages = Math.max(1, Math.ceil(count / 25));
  function href(next: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params))
      if (
        typeof value === "string" &&
        !["pagina", "editar", "novo"].includes(key)
      )
        query.set(key, value);
    query.set("pagina", String(next));
    return `${path}?${query}`;
  }
  return (
    <nav className="pagination" aria-label="Paginação">
      <p>
        {count} registro{count !== 1 ? "s" : ""} · Página {page} de {pages}
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link className="btn btn-secondary" href={href(page - 1)}>
            Anterior
          </Link>
        )}
        {page < pages && (
          <Link className="btn btn-secondary" href={href(page + 1)}>
            Próxima
          </Link>
        )}
        {page > pages && (
          <Link className="btn btn-secondary" href={href(1)}>
            Primeira página
          </Link>
        )}
      </div>
    </nav>
  );
}
