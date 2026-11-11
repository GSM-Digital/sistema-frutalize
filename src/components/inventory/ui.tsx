import Link from "next/link";
import type {
  InventoryLot,
  InventoryMovement,
  SearchParams,
} from "@/lib/inventory/types";
import { movementKinds } from "@/lib/inventory/types";
import { dateTime, quantity } from "@/lib/inventory/format";

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
  lot: Pick<InventoryLot, "quantity" | "expires_on">;
  today: string;
}) {
  if (lot.quantity === 0) return <span className="badge">Sem saldo</span>;
  if (lot.expires_on && lot.expires_on < today)
    return <span className="badge badge-danger">Vencido</span>;
  return null;
}
export function MovementsTable({
  movements,
}: {
  movements: InventoryMovement[];
}) {
  return (
    <>
      <ul
        className="movements-mobile-list"
        aria-label="Histórico de movimentações do estoque"
      >
        {movements.map((m) => (
          <li className="movement-mobile-card" key={m.id}>
            <div className="movement-mobile-top">
              <span
                className={`badge ${m.kind === "receipt" ? "badge-green" : m.kind === "loss" ? "badge-danger" : ""}`}
              >
                {movementKinds[m.kind]}
              </span>
              <strong className="tabular-nums">
                {m.quantity > 0 ? "+" : ""}
                {quantity(m.quantity, m.unit)}
              </strong>
            </div>
            <Link
              className="text-link movement-mobile-product"
              href={`/dashboard/lotes/${m.lot_id}`}
            >
              {m.product_name}
            </Link>
            {!m.is_default && (
              <span className="table-sub">{m.variant_name}</span>
            )}
            <span className="movement-mobile-code">{m.lot_code}</span>
            <p className="movement-mobile-reason">{m.reason}</p>
            <dl className="movement-mobile-meta">
              <div>
                <dt>Saldo após</dt>
                <dd>{quantity(m.balance_after, m.unit)}</dd>
              </div>
              <div>
                <dt>Responsável</dt>
                <dd>{m.actor_name}</dd>
              </div>
              <div>
                <dt>Registrado em</dt>
                <dd>{dateTime(m.created_at)}</dd>
              </div>
              <div>
                <dt>Operação em</dt>
                <dd>{dateTime(m.operated_at)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <div className="table-scroll movements-desktop-table">
        <table>
          <caption className="sr-only">
            Histórico de movimentações do estoque
          </caption>
          <thead>
            <tr>
              <th>Movimentação</th>
              <th>Item / lote</th>
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
                    {!m.is_default && `${m.variant_name} · `}
                    {m.lot_code}
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
    </>
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
