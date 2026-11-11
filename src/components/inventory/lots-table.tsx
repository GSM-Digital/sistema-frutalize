"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { removeSelectedLots } from "@/app/dashboard/inventory-actions";
import { quantity, shortDate } from "@/lib/inventory/format";
import type { InventoryLot } from "@/lib/inventory/types";

function LotBadge({ lot, today }: { lot: InventoryLot; today: string }) {
  if (lot.quantity === 0) return <span className="badge">Sem saldo</span>;
  if (lot.expires_on && lot.expires_on < today)
    return <span className="badge badge-danger">Vencido</span>;
  return null;
}

export function LotsTable({
  lots,
  today,
}: {
  lots: InventoryLot[];
  today: string;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, startTransition] = useTransition();
  const inFlight = useRef(false);
  const selectable = lots.filter((lot) => lot.quantity > 0);
  const selected = lots.filter(
    (lot) => selectedIds.includes(lot.id) && lot.quantity > 0,
  );
  const eligibleForProduction =
    selected.length > 0 &&
    selected.every(
      (lot) =>
        lot.category_name === "Frutas recebidas" &&
        (!lot.expires_on || lot.expires_on >= today) &&
        lot.product_name === selected[0].product_name,
    );

  function toggle(id: string) {
    setConfirmRemove(false);
    setMessage("");
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function selectAll() {
    setConfirmRemove(false);
    setMessage("");
    setSelectedIds(
      selectable.every((lot) => selectedIds.includes(lot.id))
        ? []
        : selectable.map((lot) => lot.id),
    );
  }

  function remove() {
    if (busy || inFlight.current || !selected.length) return;
    inFlight.current = true;
    const requests = selected.map((lot) => ({
      lotId: lot.id,
      requestId: crypto.randomUUID(),
      quantity: Number(lot.quantity),
    }));
    setConfirmRemove(false);
    startTransition(async () => {
      try {
        const result = await removeSelectedLots(requests);
        const failed = result.failures.filter((item) => item.id);
        setSelectedIds(failed.map((item) => item.id));
        setMessage(
          result.failures.length
            ? `${result.completedIds.length} lote(s) baixado(s). ${result.failures.map((item) => item.message).join(" ")}`
            : `${result.completedIds.length} lote(s) baixado(s) do estoque. Histórico preservado.`,
        );
        router.refresh();
      } catch {
        setMessage(
          "Não foi possível confirmar o resultado. Atualize a página e confira os saldos antes de tentar novamente.",
        );
      } finally {
        inFlight.current = false;
      }
    });
  }

  return (
    <>
      <div className="lots-selection-bar">
        <label className="lots-select-all">
          <input
            type="checkbox"
            checked={
              selectable.length > 0 &&
              selectable.every((lot) => selectedIds.includes(lot.id))
            }
            onChange={selectAll}
            disabled={busy || !selectable.length}
          />
          Selecionar lotes desta página
        </label>
        {selected.length > 0 && (
          <span className="lots-selected-count">
            {selected.length} selecionado{selected.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {selected.length > 0 && (
        <div className="lots-bulk-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !eligibleForProduction}
            onClick={() =>
              router.push(
                `/dashboard/producao/nova?lotes=${selected.map((lot) => lot.id).join(",")}`,
              )
            }
          >
            Enviar à produção
          </button>
          <button
            type="button"
            className="btn lots-remove-button"
            disabled={busy}
            onClick={() => setConfirmRemove(true)}
          >
            Remover do estoque
          </button>
          <button
            type="button"
            className="text-link"
            disabled={busy}
            onClick={() => {
              setSelectedIds([]);
              setConfirmRemove(false);
            }}
          >
            Limpar seleção
          </button>
          {!eligibleForProduction && (
            <p className="lots-bulk-hint">
              Para produzir, escolha lotes da mesma fruta, com saldo e dentro da
              validade.
            </p>
          )}
        </div>
      )}
      {confirmRemove && (
        <div
          className="lots-remove-confirm"
          role="group"
          aria-label="Confirmar baixa dos lotes selecionados"
        >
          <p>
            <strong>
              Remover {selected.length} lote{selected.length === 1 ? "" : "s"}{" "}
              do estoque?
            </strong>
          </p>
          <p>
            O saldo completo de cada lote será baixado como perda/descarte. A
            movimentação ficará no histórico.
          </p>
          <ul>
            {selected.map((lot) => (
              <li key={lot.id}>
                {lot.product_name} · {lot.code} ·{" "}
                {quantity(lot.quantity, lot.unit)}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn lots-remove-button"
              onClick={remove}
              disabled={busy}
            >
              Confirmar baixa
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirmRemove(false)}
              disabled={busy}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className="lots-bulk-message" role="status">
          {message}
        </p>
      )}
      <ul
        className="lots-mobile-list"
        aria-label="Lotes por item e local de armazenamento"
      >
        {lots.map((lot) => (
          <li
            className={`lot-mobile-card${selectedIds.includes(lot.id) ? " lot-selected" : ""}`}
            key={lot.id}
          >
            <div className="lot-mobile-heading">
              <label className="lot-select-label">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(lot.id)}
                  onChange={() => toggle(lot.id)}
                  disabled={busy || lot.quantity <= 0}
                  aria-label={`Selecionar lote ${lot.code}`}
                />
              </label>
              <div className="lot-mobile-identity">
                <Link
                  className="lot-mobile-title"
                  href={`/dashboard/lotes/${lot.id}`}
                >
                  {lot.product_name}
                </Link>
                {!lot.is_default && (
                  <span className="table-sub">
                    {lot.variant_name} · {lot.sku}
                  </span>
                )}
                <span className="table-sub font-mono">{lot.code}</span>
              </div>
              <Link
                className="lot-mobile-action"
                href={`/dashboard/lotes/${lot.id}`}
                aria-label={`Consultar lote ${lot.code}`}
              >
                Abrir <span aria-hidden="true">→</span>
              </Link>
            </div>
            <dl className="lot-mobile-details">
              <div className="lot-mobile-location">
                <dt>Local</dt>
                <dd>{lot.location_name}</dd>
              </div>
              <div>
                <dt>Saldo</dt>
                <dd className="tabular-nums font-semibold">
                  {quantity(lot.quantity, lot.unit)}
                </dd>
              </div>
              <div>
                <dt>Validade</dt>
                <dd>
                  {lot.expires_on ? shortDate(lot.expires_on) : "Não se aplica"}
                </dd>
                <LotBadge lot={lot} today={today} />
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <div className="table-scroll lots-desktop-table">
        <table>
          <caption className="sr-only">
            Lotes por tamanho/embalagem e local de armazenamento
          </caption>
          <thead>
            <tr>
              <th>
                <span className="sr-only">Selecionar</span>
              </th>
              <th>Item / lote</th>
              <th>Local</th>
              <th>Saldo</th>
              <th>Validade</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr
                key={lot.id}
                className={selectedIds.includes(lot.id) ? "lot-selected" : ""}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(lot.id)}
                    onChange={() => toggle(lot.id)}
                    disabled={busy || lot.quantity <= 0}
                    aria-label={`Selecionar lote ${lot.code}`}
                  />
                </td>
                <td>
                  <Link
                    className="text-link"
                    href={`/dashboard/lotes/${lot.id}`}
                  >
                    {lot.product_name}
                  </Link>
                  {!lot.is_default && (
                    <span className="table-sub">
                      {lot.variant_name} · {lot.sku}
                    </span>
                  )}
                  <span className="table-sub font-mono">{lot.code}</span>
                </td>
                <td>{lot.location_name}</td>
                <td className="tabular-nums whitespace-nowrap font-semibold">
                  {quantity(lot.quantity, lot.unit)}
                </td>
                <td className="whitespace-nowrap">
                  {lot.expires_on ? shortDate(lot.expires_on) : "Não se aplica"}
                  <span className="table-sub">
                    <LotBadge lot={lot} today={today} />
                  </span>
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
    </>
  );
}
