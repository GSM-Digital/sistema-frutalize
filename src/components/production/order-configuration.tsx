"use client";

import { useState } from "react";
import type { Json } from "@/lib/inventory/types";
import type { TerminalSnapshot } from "@/lib/production/ui-types";
import { quantity } from "@/lib/inventory/format";

export function OrderConfiguration({
  snapshot,
  create = false,
  busy,
  onSubmit,
}: {
  snapshot: TerminalSnapshot;
  create?: boolean;
  busy: boolean;
  onSubmit: (payload: Record<string, Json>) => void;
}) {
  const [procedureId, setProcedureId] = useState("");
  const [lines, setLines] = useState([0]);
  const procedure = snapshot.procedures.find((item) => item.id === procedureId);
  const profiles = snapshot.profiles.filter(
    (item) =>
      item.product_id === procedure?.product_id &&
      item.output_variant_id === procedure?.output_variant_id,
  );
  const qualitySpecs = snapshot.qualitySpecs.filter(
    (item) => item.output_variant_id === procedure?.output_variant_id,
  );
  return (
    <form
      className="inventory-form mt-5"
      action={(data) => {
        const payload: Record<string, Json> = {
          procedure_id: String(data.get("procedure_id")),
          profile_id: String(data.get("profile_id")),
          quality_spec_id: String(data.get("quality_spec_id")),
        };
        if (create) {
          payload.inputs = data.getAll("lot_id").map((lot, index) => ({
            lot_id: String(lot),
            quantity: Number(data.getAll("quantity")[index]),
          }));
        }
        onSubmit(payload);
      }}
    >
      <div className="field">
        <label htmlFor="order-procedure">Procedimento aprovado</label>
        <select
          id="order-procedure"
          name="procedure_id"
          value={procedureId}
          onChange={(event) => setProcedureId(event.target.value)}
          required
          disabled={busy}
        >
          <option value="">Selecione</option>
          {snapshot.procedures.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · Rev. {item.revision}
            </option>
          ))}
        </select>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="order-profile">
            Perfil aprovado para a apresentação
          </label>
          <select
            id="order-profile"
            name="profile_id"
            required
            disabled={busy || !procedure}
            key={procedureId}
          >
            <option value="">Selecione</option>
            {profiles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · Rev. {item.revision}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="order-quality">Regra de qualidade aprovada</label>
          <select
            id="order-quality"
            name="quality_spec_id"
            required
            disabled={busy || !procedure}
            key={procedureId}
          >
            <option value="">Selecione</option>
            {qualitySpecs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · Rev. {item.revision}
              </option>
            ))}
          </select>
        </div>
      </div>
      {procedure && (!profiles.length || !qualitySpecs.length) && (
        <p className="notice">
          Falta um perfil ou uma regra de qualidade aprovada para a apresentação
          deste procedimento. O administrador precisa concluir a configuração.
        </p>
      )}
      {create && (
        <>
          <fieldset>
            <legend>Lotes e quantidades reais de entrada</legend>
            {lines.map((line, index) => (
              <div className="form-grid mb-4" key={line}>
                <div className="field">
                  <label htmlFor={`input-lot-${line}`}>
                    Lote de origem {index + 1}
                  </label>
                  <select
                    id={`input-lot-${line}`}
                    name="lot_id"
                    required
                    disabled={busy}
                  >
                    <option value="">Selecione</option>
                    {snapshot.lots.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.code} · {lot.product_name} ·{" "}
                        {quantity(Number(lot.quantity), lot.unit)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`input-quantity-${line}`}>
                    Quantidade na unidade do lote
                  </label>
                  <div className="flex gap-2">
                    <input
                      id={`input-quantity-${line}`}
                      name="quantity"
                      required
                      type="number"
                      min="0.001"
                      step="0.001"
                      disabled={busy}
                    />
                    {lines.length > 1 && (
                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() =>
                          setLines((current) =>
                            current.filter((item) => item !== line),
                          )
                        }
                        disabled={busy}
                        aria-label={`Remover entrada ${index + 1}`}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setLines((current) => [...current, Math.max(...current) + 1])
              }
              disabled={busy || lines.length >= 30}
            >
              Adicionar insumo
            </button>
          </fieldset>
        </>
      )}
      <p className="muted text-sm">
        As revisões escolhidas ficam preservadas nesta ordem. Uma aprovação
        futura não altera suas instruções.
      </p>
      <button
        className="terminal-btn terminal-btn-primary"
        disabled={
          busy || !procedure || !profiles.length || !qualitySpecs.length
        }
      >
        {create
          ? "Criar ordem com estes insumos"
          : "Vincular revisões aprovadas"}
      </button>
    </form>
  );
}
