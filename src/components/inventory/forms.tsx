"use client";
import { useActionState, useId, useState } from "react";
import Link from "next/link";
import {
  changeLotStatus,
  moveStock,
  receiveLot,
  saveCatalog,
} from "@/app/dashboard/inventory-actions";
import { money } from "@/lib/inventory/format";
import {
  statuses,
  units,
  type ActionState,
  type CatalogEntity,
  type CatalogOptions,
  type CatalogRecord,
  type InventoryLot,
} from "@/lib/inventory/types";

type FieldProps = {
  label: string;
  name: string;
  value?: string | number;
  hint?: string;
  required?: boolean;
  maxLength?: number;
  type?: string;
  children?: React.ReactNode;
  onChange?: (value: string) => void;
  max?: string;
  rows?: number;
  inputMode?: "decimal" | "text" | "tel";
};
function Field({
  label,
  name,
  value = "",
  hint,
  required = false,
  maxLength = 120,
  type = "text",
  children,
  onChange,
  max,
  rows,
  inputMode,
}: FieldProps) {
  const id = useId();
  const [fieldValue, setFieldValue] = useState(String(value));
  const shared = {
    id,
    name,
    value: fieldValue,
    required,
    "aria-describedby": hint ? `${id}-hint` : undefined,
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setFieldValue(e.target.value);
      onChange?.(e.target.value);
    },
  };
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children ? (
        <select {...shared}>{children}</select>
      ) : rows ? (
        <textarea {...shared} maxLength={maxLength} rows={rows} />
      ) : (
        <input
          {...shared}
          type={type}
          maxLength={maxLength}
          max={max}
          inputMode={inputMode}
        />
      )}{" "}
      {hint && <p id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}
function Result({ state }: { state: ActionState }) {
  return (
    <>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="form-success">
          {state.success}
          {state.lotId && (
            <Link
              className="text-link block mt-2"
              href={`/dashboard/lotes/${state.lotId}`}
            >
              Abrir o lote recebido →
            </Link>
          )}
        </p>
      )}
    </>
  );
}
function SaveButton({
  pending,
  children,
  disabled = false,
}: {
  pending: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="btn btn-primary"
    >
      {pending ? "Salvando…" : children}
    </button>
  );
}
function useStockAction(
  serverAction: (previous: ActionState, data: FormData) => Promise<ActionState>,
  initialRequestId: string,
  onSuccess?: () => void,
) {
  const [operationId, setOperationId] = useState(initialRequestId);
  const [state, action, pending] = useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await serverAction(previous, data);
      if (result.success) {
        setOperationId(crypto.randomUUID());
        onSuccess?.();
      }
      return result;
    },
    {},
  );
  return { state, action, pending, operationId };
}

export function CatalogForm({
  entity,
  record,
  options,
  skuSuggestion,
  cancelHref,
}: {
  entity: CatalogEntity;
  record?: CatalogRecord;
  options: CatalogOptions;
  skuSuggestion: string;
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState(saveCatalog, {});
  const v = (key: string, fallback = "") =>
    state.values?.[key] ?? String(record?.[key] ?? fallback);
  return (
    <form
      key={state.successId ?? "initial"}
      action={action}
      className="inventory-form"
    >
      <input type="hidden" name="entity" value={entity} />
      <input type="hidden" name="id" value={record?.id ?? ""} />
      <fieldset disabled={pending}>
        <legend className="sr-only">Dados do cadastro</legend>
        <div className="form-grid">
          <Field
            label="Nome"
            name="name"
            required
            maxLength={
              entity === "products" || entity === "suppliers" ? 120 : 80
            }
            value={v("name")}
            hint={
              entity === "variants"
                ? "Ex.: padrão, pacote de 500 g ou embalagem de 1 kg."
                : undefined
            }
          />
          {entity === "products" && (
            <>
              <Field
                label="Categoria"
                name="category_id"
                required
                value={v("category_id")}
              >
                <option value="">Selecione</option>
                {options.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {!c.active ? " (arquivada)" : ""}
                  </option>
                ))}
              </Field>
              <Field
                label="Exige validade no recebimento?"
                name="requires_expiry"
                value={v("requires_expiry", "true")}
              >
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </Field>
            </>
          )}
          {entity === "variants" && (
            <>
              <Field
                label="Produto principal"
                name="product_id"
                required
                value={v("product_id")}
              >
                <option value="">Selecione</option>
                {options.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {!p.active ? " (arquivado)" : ""}
                  </option>
                ))}
              </Field>
              <Field
                label="SKU"
                name="sku"
                required
                maxLength={40}
                value={v("sku", skuSuggestion)}
                hint="Sugestão editável. Use letras, números, ponto, traço ou sublinhado."
              />
              <Field
                label="Peso de uma unidade (kg)"
                name="unit_weight_kg"
                inputMode="decimal"
                value={v("unit_weight_kg")}
                hint="Opcional. Ex.: 0,5 para uma embalagem de 500 g. Não estime o peso de frutas."
              />
            </>
          )}
          {entity === "suppliers" && (
            <>
              <Field
                label="CNPJ"
                name="cnpj"
                maxLength={20}
                value={v("cnpj")}
              />
              <Field
                label="Telefone"
                name="phone"
                type="tel"
                maxLength={30}
                value={v("phone")}
              />
              <Field
                label="Pessoa de contato"
                name="contact_name"
                value={v("contact_name")}
              />
              <Field
                label="Endereço"
                name="address"
                maxLength={240}
                value={v("address")}
              />
            </>
          )}
          {entity === "locations" && (
            <Field
              label="Descrição"
              name="description"
              maxLength={240}
              value={v("description")}
            />
          )}
          <Field
            label="Situação do cadastro"
            name="active"
            value={v("active", "true")}
            hint="Arquivar impede novos recebimentos e preserva todo o histórico."
          >
            <option value="true">Ativo</option>
            <option value="false">Arquivado</option>
          </Field>
          <Field
            label="Motivo do registro ou alteração"
            name="reason"
            required
            maxLength={240}
            value={state.values?.reason ?? (record ? "" : "Cadastro inicial")}
          />
        </div>
      </fieldset>
      <Result state={state} />
      <div className="flex flex-wrap gap-3">
        <SaveButton pending={pending}>Salvar cadastro</SaveButton>
        <Link href={cancelHref} className="btn btn-secondary">
          Fechar formulário
        </Link>
      </div>
    </form>
  );
}

export function ReceiptForm({
  options,
  requestId,
  now,
  today,
}: {
  options: CatalogOptions;
  requestId: string;
  now: string;
  today: string;
}) {
  const [preview, setPreview] = useState({ quantity: "", cost: "" });
  const { state, action, pending, operationId } = useStockAction(
    receiveLot,
    requestId,
    () => setPreview({ quantity: "", cost: "" }),
  );
  const v = (key: string, fallback = "") => state.values?.[key] ?? fallback;
  const qty = Number(preview.quantity.replace(",", "."));
  const cost = Number(preview.cost.replace(",", "."));
  return (
    <form
      key={state.successId ?? "initial"}
      action={action}
      className="inventory-form"
    >
      <input
        type="hidden"
        name="request_id"
        value={v("request_id", operationId)}
      />
      <fieldset disabled={pending}>
        <legend>Identificação do recebimento</legend>
        <div className="form-grid">
          <Field
            label="Produto e apresentação"
            name="variant_id"
            required
            value={v("variant_id")}
          >
            <option value="">Selecione</option>
            {options.variants
              .filter((x) => x.active && x.product_active && x.category_active)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.product_name} · {x.name} ({x.sku})
                  {x.requires_expiry ? " · exige validade" : ""}
                </option>
              ))}
          </Field>
          <Field
            label="Fornecedor"
            name="supplier_id"
            required
            value={v("supplier_id")}
          >
            <option value="">Selecione</option>
            {options.suppliers
              .filter((x) => x.active)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </Field>
          <Field
            label="Nota fiscal ou referência"
            name="reference"
            required
            maxLength={80}
            value={v("reference")}
          />
          <Field
            label="Local físico de armazenamento"
            name="location_id"
            required
            value={v("location_id")}
            hint="Informe onde o lote ficará fisicamente, mesmo durante a quarentena."
          >
            <option value="">Selecione</option>
            {options.locations
              .filter((x) => x.active)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </Field>
          <Field
            label="Lote do fornecedor"
            name="supplier_lot"
            maxLength={80}
            value={v("supplier_lot")}
          />
          <Field
            label="Lote interno"
            name="code"
            maxLength={80}
            value={v("code")}
            hint="Opcional. Em branco, gera SKU + data + sequência. Padrão provisório, a validar para o datador."
          />
          <Field
            label="Data e hora do recebimento"
            name="received_at"
            type="datetime-local"
            required
            value={v("received_at", now)}
            hint="Horário de Brasília. A data real do registro também será preservada."
          />
          <Field
            label="Data de fabricação"
            name="manufactured_on"
            type="date"
            max={today}
            value={v("manufactured_on")}
          />
          <Field
            label="Validade"
            name="expires_on"
            type="date"
            value={v("expires_on")}
            hint="Obrigatória para produtos configurados com controle de validade."
          />
          <Field
            label="Origem da validade"
            name="expiry_source"
            required
            value={v("expiry_source", "supplier")}
          >
            <option value="supplier">Informada pelo fornecedor</option>
            <option value="internal">
              Definida internamente pelo responsável
            </option>
            <option value="not_applicable">Não se aplica ao item</option>
          </Field>
        </div>
      </fieldset>
      <fieldset disabled={pending}>
        <legend>Quantidade e custo</legend>
        <div className="form-grid">
          <Field
            label="Quantidade recebida"
            name="quantity"
            required
            inputMode="decimal"
            value={v("quantity")}
            onChange={(quantity) => setPreview((old) => ({ ...old, quantity }))}
          />
          <Field
            label="Unidade deste recebimento"
            name="unit"
            required
            value={v("unit", "kg")}
          >
            <>
              {Object.entries(units).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </>
          </Field>
          <Field
            label="Peso líquido total (kg)"
            name="net_weight_kg"
            inputMode="decimal"
            value={v("net_weight_kg")}
            hint="Opcional para itens pesados. Em kg/g ou unidade com peso conhecido, o sistema calcula. Sem pesagem, deixe em branco."
          />
          <Field
            label="Preço total (R$)"
            name="total_cost"
            required
            inputMode="decimal"
            value={v("total_cost")}
            onChange={(cost) => setPreview((old) => ({ ...old, cost }))}
            hint="Use 0 para entrada sem custo. Não use separador de milhar."
          />
        </div>
        <p className="muted text-sm mt-4" aria-live="polite">
          Custo por unidade informada:{" "}
          {qty > 0 && Number.isFinite(cost) && preview.cost
            ? money(cost / qty, 6)
            : "calculado ao informar quantidade e preço"}
          .
        </p>
      </fieldset>
      <fieldset disabled={pending}>
        <legend>Conferência de qualidade</legend>
        <Field
          label="Observações da inspeção"
          name="inspection_notes"
          rows={4}
          required
          maxLength={1000}
          value={v("inspection_notes")}
          hint="Descreva a condição observada e eventuais não conformidades, conforme o procedimento aprovado da fábrica."
        />
      </fieldset>
      <p className="notice text-sm">
        O recebimento será registrado integralmente em quarentena. A liberação
        exige uma conferência separada por administrador autorizado.
      </p>
      <Result state={state} />
      <div className="flex flex-wrap gap-3">
        <SaveButton pending={pending}>Registrar recebimento</SaveButton>
        <Link href="/dashboard/lotes" className="btn btn-secondary">
          Consultar estoque
        </Link>
      </div>
    </form>
  );
}

export function MovementForm({
  lot,
  requestId,
  now,
  today,
}: {
  lot: InventoryLot;
  requestId: string;
  now: string;
  today: string;
}) {
  const { state, action, pending, operationId } = useStockAction(
    moveStock,
    requestId,
  );
  const v = (key: string, fallback = "") => state.values?.[key] ?? fallback;
  const canDispatch =
    lot.status === "released" && (!lot.expires_on || lot.expires_on >= today);
  return (
    <form
      key={state.successId ?? "initial"}
      action={action}
      className="inventory-form"
    >
      <input
        type="hidden"
        name="request_id"
        value={v("request_id", operationId)}
      />
      <input type="hidden" name="lot_id" value={lot.id} />
      <fieldset disabled={pending || lot.quantity === 0}>
        <legend className="sr-only">Nova movimentação</legend>
        <div className="form-grid">
          <Field
            label="Tipo"
            name="kind"
            value={v("kind", canDispatch ? "dispatch" : "loss")}
          >
            <option value="dispatch" disabled={!canDispatch}>
              Saída
            </option>
            <option value="loss">Perda / descarte</option>
          </Field>
          <Field
            label={`Quantidade (${lot.unit})`}
            name="quantity"
            required
            inputMode="decimal"
            value={v("quantity")}
          />
          <Field
            label="Data e hora operacional"
            name="operated_at"
            type="datetime-local"
            required
            value={v("operated_at", now)}
            hint="Horário de Brasília. Não pode anteceder o recebimento."
          />
          <Field
            label="Motivo / destino"
            name="reason"
            required
            maxLength={240}
            value={v("reason")}
          />
        </div>
      </fieldset>
      {!canDispatch && (
        <p className="muted text-sm">
          Saídas exigem um lote liberado e dentro da validade. Perdas e
          descartes exigem justificativa.
        </p>
      )}
      <Result state={state} />
      <SaveButton pending={pending} disabled={lot.quantity === 0}>
        Registrar movimentação
      </SaveButton>
    </form>
  );
}
export function StatusForm({
  lot,
  requestId,
  today,
}: {
  lot: InventoryLot;
  requestId: string;
  today: string;
}) {
  const { state, action, pending, operationId } = useStockAction(
    changeLotStatus,
    requestId,
  );
  const v = (key: string, fallback = "") => state.values?.[key] ?? fallback;
  return (
    <form
      key={state.successId ?? "initial"}
      action={action}
      className="inventory-form"
    >
      <input
        type="hidden"
        name="request_id"
        value={v("request_id", operationId)}
      />
      <input type="hidden" name="lot_id" value={lot.id} />
      <fieldset disabled={pending || lot.quantity === 0}>
        <legend className="sr-only">Alterar situação do lote</legend>
        <div className="form-grid">
          <Field
            label="Nova situação"
            name="status"
            required
            value={v("status")}
          >
            <option value="">Selecione</option>
            {Object.entries(statuses)
              .filter(([key]) => key !== lot.status)
              .map(([key, label]) => (
                <option
                  key={key}
                  value={key}
                  disabled={
                    key === "released" &&
                    Boolean(lot.expires_on && lot.expires_on < today)
                  }
                >
                  {label}
                </option>
              ))}
          </Field>
          <Field
            label="Justificativa da conferência"
            name="reason"
            required
            maxLength={240}
            value={v("reason")}
          />
        </div>
      </fieldset>
      <Result state={state} />
      <SaveButton pending={pending} disabled={lot.quantity === 0}>
        Atualizar situação
      </SaveButton>
    </form>
  );
}
