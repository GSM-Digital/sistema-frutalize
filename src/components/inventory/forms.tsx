"use client";
import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  completeProduction,
  receiveDelivery,
  registerLotOperation,
  saveCatalog,
} from "@/app/dashboard/inventory-actions";
import { money } from "@/lib/inventory/format";
import {
  externalDestinations,
  lotOperations,
  units,
  type ActionState,
  type CatalogEntity,
  type CatalogOptions,
  type CatalogRecord,
  type InventoryLot,
  type InventoryVariant,
  type Location,
  type LotOperation,
  type Unit,
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
          {state.receiptId && (
            <Link className="text-link block mt-2" href="/dashboard/lotes">
              Consultar os lotes recebidos →
            </Link>
          )}
          {state.productionId && (
            <Link
              className="text-link block mt-2"
              href={`/dashboard/producao/${state.productionId}`}
            >
              Abrir a produção iniciada →
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
              <Field
                label="Possui tamanhos ou embalagens separados?"
                name="has_variants"
                value={v("has_variants", "false")}
                hint="Use Não para frutas, toucas, uniformes e itens recebidos diretamente. Use Sim quando cada tamanho ou embalagem precisa de saldo próprio, como polpa de 500 g e 1 kg."
              >
                <option value="false">Não, entrada direta</option>
                <option value="true">Sim, controlar separadamente</option>
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
                {options.products
                  .filter((p) => p.has_variants)
                  .map((p) => (
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

type ReceiptDraft = {
  key: string;
  variant_id: string;
  location_id: string;
  supplier_lot: string;
  code: string;
  manufactured_on: string;
  expires_on: string;
  expiry_source: "supplier" | "internal" | "not_applicable";
  unit: Unit;
  quantity: string;
  net_weight_kg: string;
  total_cost: string;
  inspection_notes: string;
};
function blankReceiptItem(key: string): ReceiptDraft {
  return {
    key,
    variant_id: "",
    location_id: "",
    supplier_lot: "",
    code: "",
    manufactured_on: "",
    expires_on: "",
    expiry_source: "not_applicable",
    unit: "kg",
    quantity: "",
    net_weight_kg: "",
    total_cost: "",
    inspection_notes: "",
  };
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
  const router = useRouter();
  const [items, setItems] = useState<ReceiptDraft[]>([
    blankReceiptItem("item-1"),
  ]);
  const [supplierId, setSupplierId] = useState("");
  const [pickerTarget, setPickerTarget] = useState<
    { kind: "item"; index: number } | { kind: "supplier" } | null
  >(null);
  const [pickerStep, setPickerStep] = useState<"choice" | "existing" | "new">(
    "choice",
  );
  const [productState, productAction, productPending] = useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await saveCatalog(previous, data);
      if (result.success) {
        router.refresh();
        setPickerStep("existing");
      }
      return result;
    },
    {},
  );
  const [supplierState, supplierAction, supplierPending] = useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await saveCatalog(previous, data);
      if (result.success && result.catalogId) {
        setSupplierId(result.catalogId);
        router.refresh();
        setPickerTarget(null);
        setPickerStep("choice");
      }
      return result;
    },
    {},
  );
  const { state, action, pending, operationId } = useStockAction(
    receiveDelivery,
    requestId,
    () => setItems([blankReceiptItem("item-1")]),
  );
  const v = (key: string, fallback = "") => state.values?.[key] ?? fallback;
  const receivable = options.variants.filter(
    (item) =>
      item.active &&
      item.product_active &&
      item.category_active &&
      ((item.has_variants && !item.is_default) ||
        (!item.has_variants && item.is_default)),
  );
  const suppliers = options.suppliers.filter((item) => item.active);
  const locations = options.locations.filter((item) => item.active);
  const canSubmit =
    items.every((item) => Boolean(item.variant_id && item.location_id)) &&
    Boolean(supplierId) &&
    locations.length > 0;
  const selectedSupplier = suppliers.find((item) => item.id === supplierId);
  const changeItem = <K extends keyof ReceiptDraft>(
    index: number,
    key: K,
    value: ReceiptDraft[K],
  ) =>
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  const chooseItem = (index: number, variantId: string) => {
    const variant = receivable.find((item) => item.id === variantId);
    const preferredLocation = variant
      ? locations.find((location) => {
          const locationName = location.name.toLocaleLowerCase("pt-BR");
          if (variant.category_name === "Frutas recebidas")
            return locationName === "estoque de frutas";
          if (variant.category_name === "Polpas prontas")
            return locationName === "freezer 1";
          return locationName === "estoque de insumos";
        })
      : undefined;
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              variant_id: variantId,
              location_id: item.location_id || preferredLocation?.id || "",
              expiry_source: variant?.requires_expiry
                ? "supplier"
                : "not_applicable",
              expires_on: variant?.requires_expiry ? item.expires_on : "",
            }
          : item,
      ),
    );
  };
  const openPicker = (
    target: { kind: "item"; index: number } | { kind: "supplier" },
  ) => {
    setPickerTarget(target);
    setPickerStep("choice");
  };
  const closePicker = () => {
    setPickerTarget(null);
    setPickerStep("choice");
  };
  const totalCost = items.reduce((total, item) => {
    const value = Number(item.total_cost.replace(",", "."));
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
  return (
    <>
      <form action={action} className="inventory-form">
        <input type="hidden" name="request_id" value={operationId} />
        <input type="hidden" name="items" value={JSON.stringify(items)} />
        <input type="hidden" name="supplier_id" value={supplierId} />
        <fieldset disabled={pending}>
          <legend>Dados da entrega</legend>
          <div className="form-grid">
            <div className="field receipt-picker-field">
              <span className="field-label">Fornecedor *</span>
              <div className="receipt-picker-value">
                <div>
                  <strong>
                    {selectedSupplier?.name ||
                      (supplierId && supplierState.catalogName) ||
                      "Nenhum fornecedor selecionado"}
                  </strong>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary receipt-picker-trigger"
                  onClick={() => openPicker({ kind: "supplier" })}
                >
                  {supplierId ? "Trocar fornecedor" : "＋ Adicionar fornecedor"}
                </button>
              </div>
            </div>
            <Field
              label="Nota fiscal ou referência"
              name="reference"
              required
              maxLength={80}
              value={v("reference")}
              hint="Pode ser o número da nota, recibo ou outra identificação da entrega."
            />
            <Field
              label="Data e hora do recebimento"
              name="received_at"
              type="datetime-local"
              required
              value={v("received_at", now)}
              hint="Horário de Brasília."
            />
          </div>
        </fieldset>

        <div className="receipt-items">
          {items.map((item, index) => {
            const selected = receivable.find(
              (variant) => variant.id === item.variant_id,
            );
            const quantityValue = Number(item.quantity.replace(",", "."));
            const costValue = Number(item.total_cost.replace(",", "."));
            return (
              <fieldset
                key={item.key}
                disabled={pending}
                className="receipt-item"
              >
                <legend>Item {index + 1}</legend>
                {items.length > 1 && (
                  <div className="receipt-item-heading">
                    <button
                      type="button"
                      className="receipt-remove-item"
                      aria-label={`Remover item ${index + 1}`}
                      title="Remover item"
                      onClick={() =>
                        setItems((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7m4-7v7" />
                      </svg>
                    </button>
                  </div>
                )}
                <div className="form-grid receipt-core-grid">
                  <div className="field receipt-picker-field">
                    <span className="field-label">Item recebido *</span>
                    <div className="receipt-picker-value">
                      <div>
                        <strong>
                          {selected
                            ? `${selected.product_name}${selected.has_variants ? ` · ${selected.name}` : ""}`
                            : "Nenhum item selecionado"}
                        </strong>
                        {selected?.requires_expiry && (
                          <small>Exige validade</small>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary receipt-picker-trigger"
                        onClick={() => openPicker({ kind: "item", index })}
                      >
                        {selected ? "Trocar item" : "＋ Adicionar item"}
                      </button>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor={`${item.key}-location`}>
                      Local físico *
                    </label>
                    <select
                      id={`${item.key}-location`}
                      required
                      value={item.location_id}
                      onChange={(event) =>
                        changeItem(index, "location_id", event.target.value)
                      }
                    >
                      <option value="">Selecione</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                    <p>
                      É o lugar real onde este item ficará: estoque, produção ou
                      freezer.
                    </p>
                  </div>
                  <div className="field receipt-half">
                    <label htmlFor={`${item.key}-quantity`}>
                      Quantidade recebida *
                    </label>
                    <input
                      id={`${item.key}-quantity`}
                      required
                      inputMode="decimal"
                      value={item.quantity}
                      onChange={(event) =>
                        changeItem(index, "quantity", event.target.value)
                      }
                    />
                  </div>
                  <div className="field receipt-half">
                    <label htmlFor={`${item.key}-unit`}>
                      Unidade da compra *
                    </label>
                    <select
                      id={`${item.key}-unit`}
                      required
                      value={item.unit}
                      onChange={(event) =>
                        changeItem(index, "unit", event.target.value as Unit)
                      }
                    >
                      {Object.entries(units).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <p>Use kg se comprou por peso ou un se contou as peças.</p>
                  </div>
                  <div className="field">
                    <label htmlFor={`${item.key}-cost`}>
                      Preço total deste item (R$) *
                    </label>
                    <input
                      id={`${item.key}-cost`}
                      required
                      inputMode="decimal"
                      value={item.total_cost}
                      onChange={(event) =>
                        changeItem(index, "total_cost", event.target.value)
                      }
                    />
                    <p>
                      Custo por {item.unit}:{" "}
                      {quantityValue > 0 && Number.isFinite(costValue)
                        ? money(costValue / quantityValue, 6)
                        : "calculado automaticamente"}
                    </p>
                  </div>
                  {selected?.requires_expiry && (
                    <>
                      <div className="field">
                        <label htmlFor={`${item.key}-expires`}>
                          Validade *
                        </label>
                        <input
                          id={`${item.key}-expires`}
                          type="date"
                          min={today}
                          required
                          value={item.expires_on}
                          onChange={(event) =>
                            changeItem(index, "expires_on", event.target.value)
                          }
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`${item.key}-expiry-source`}>
                          Origem da validade *
                        </label>
                        <select
                          id={`${item.key}-expiry-source`}
                          value={item.expiry_source}
                          onChange={(event) =>
                            changeItem(
                              index,
                              "expiry_source",
                              event.target
                                .value as ReceiptDraft["expiry_source"],
                            )
                          }
                        >
                          <option value="supplier">
                            Informada pelo fornecedor
                          </option>
                          <option value="internal">
                            Definida internamente
                          </option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
                <details className="receipt-more">
                  <summary>
                    <span>Mais informações do item</span>
                    <small>Opcional</small>
                  </summary>
                  <div className="form-grid receipt-more-grid">
                    <div className="field">
                      <label htmlFor={`${item.key}-weight`}>
                        Peso líquido total (kg)
                      </label>
                      <input
                        id={`${item.key}-weight`}
                        inputMode="decimal"
                        value={item.net_weight_kg}
                        onChange={(event) =>
                          changeItem(index, "net_weight_kg", event.target.value)
                        }
                      />
                      <p>
                        Ao comprar por unidade, informe o peso real se houver
                        pesagem.
                      </p>
                    </div>
                    <div className="field">
                      <label htmlFor={`${item.key}-supplier-lot`}>
                        Lote do fornecedor
                      </label>
                      <input
                        id={`${item.key}-supplier-lot`}
                        maxLength={80}
                        value={item.supplier_lot}
                        onChange={(event) =>
                          changeItem(index, "supplier_lot", event.target.value)
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`${item.key}-code`}>Lote interno</label>
                      <input
                        id={`${item.key}-code`}
                        maxLength={80}
                        value={item.code}
                        onChange={(event) =>
                          changeItem(index, "code", event.target.value)
                        }
                      />
                      <p>Em branco, o sistema gera o código.</p>
                    </div>
                    <div className="field">
                      <label htmlFor={`${item.key}-manufactured`}>
                        Data de fabricação
                      </label>
                      <input
                        id={`${item.key}-manufactured`}
                        type="date"
                        max={today}
                        value={item.manufactured_on}
                        onChange={(event) =>
                          changeItem(
                            index,
                            "manufactured_on",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                </details>
                <div className="field receipt-notes">
                  <label htmlFor={`${item.key}-inspection`}>
                    Conferência de qualidade *
                  </label>
                  <textarea
                    id={`${item.key}-inspection`}
                    rows={3}
                    maxLength={1000}
                    required
                    value={item.inspection_notes}
                    onChange={(event) =>
                      changeItem(index, "inspection_notes", event.target.value)
                    }
                  />
                  <p>
                    Registre avarias, rejeições ou outras observações reais.
                  </p>
                </div>
              </fieldset>
            );
          })}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending || receivable.length === 0 || items.length >= 50}
          onClick={() =>
            setItems((current) => [
              ...current,
              blankReceiptItem(crypto.randomUUID()),
            ])
          }
        >
          ＋ Adicionar outro item desta entrega
        </button>
        <div className="receipt-summary" aria-live="polite">
          <span>
            {items.length} {items.length === 1 ? "item" : "itens"}
          </span>
          <strong>Total da entrega: {money(totalCost)}</strong>
        </div>
        <Result state={state} />
        <div className="receipt-actions">
          <SaveButton pending={pending} disabled={!canSubmit}>
            Registrar recebimento
          </SaveButton>
          <Link href="/dashboard/lotes" className="btn btn-secondary">
            Consultar estoque
          </Link>
        </div>
      </form>

      {pickerTarget && (
        <div
          className="receipt-picker-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePicker();
          }}
        >
          <section
            className="receipt-picker-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-picker-title"
          >
            <header>
              <div>
                <span className="eyebrow">Adicionar ao recebimento</span>
                <h2 id="receipt-picker-title">
                  {pickerTarget.kind === "item"
                    ? "Adicionar item"
                    : "Adicionar fornecedor"}
                </h2>
              </div>
              <button
                type="button"
                className="receipt-picker-close"
                aria-label="Fechar"
                onClick={closePicker}
              >
                ×
              </button>
            </header>

            {pickerStep === "choice" && (
              <div className="receipt-picker-choices">
                <button type="button" onClick={() => setPickerStep("existing")}>
                  <strong>Escolher um cadastro existente</strong>
                  <span>Usar o que já está cadastrado no sistema.</span>
                </button>
                <button type="button" onClick={() => setPickerStep("new")}>
                  <strong>
                    Cadastrar novo{" "}
                    {pickerTarget.kind === "item" ? "item" : "fornecedor"}
                  </strong>
                  <span>Criar agora, sem sair do recebimento.</span>
                </button>
              </div>
            )}

            {pickerStep === "existing" && (
              <div className="receipt-picker-existing">
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setPickerStep("choice")}
                >
                  ← Voltar
                </button>
                <div className="field">
                  {pickerTarget.kind === "item" && productState.success && (
                    <Result state={productState} />
                  )}
                  <label htmlFor="receipt-existing-picker">
                    {pickerTarget.kind === "item"
                      ? "Item cadastrado"
                      : "Fornecedor cadastrado"}
                  </label>
                  <select
                    id="receipt-existing-picker"
                    defaultValue=""
                    onChange={(event) => {
                      if (!event.target.value) return;
                      if (pickerTarget.kind === "item")
                        chooseItem(pickerTarget.index, event.target.value);
                      else setSupplierId(event.target.value);
                      closePicker();
                    }}
                  >
                    <option value="">Selecione</option>
                    {pickerTarget.kind === "item"
                      ? receivable.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.product_name}
                            {variant.has_variants ? ` · ${variant.name}` : ""}
                            {variant.requires_expiry ? " · exige validade" : ""}
                          </option>
                        ))
                      : suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                  </select>
                </div>
              </div>
            )}

            {pickerStep === "new" && pickerTarget.kind === "item" && (
              <form
                key={productState.successId ?? "new-receipt-item"}
                action={productAction}
                className="inventory-form receipt-picker-form"
              >
                <input type="hidden" name="entity" value="products" />
                <input type="hidden" name="active" value="true" />
                <input type="hidden" name="has_variants" value="false" />
                <input
                  type="hidden"
                  name="reason"
                  value="Cadastro durante recebimento"
                />
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setPickerStep("choice")}
                >
                  ← Voltar
                </button>
                <fieldset disabled={productPending}>
                  <div className="form-grid">
                    <Field label="Nome do item" name="name" required />
                    <Field label="Categoria" name="category_id" required>
                      <option value="">Selecione</option>
                      {options.categories
                        .filter((item) => item.active)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </Field>
                    <Field
                      label="Exige validade?"
                      name="requires_expiry"
                      value="false"
                    >
                      <option value="false">Não</option>
                      <option value="true">Sim</option>
                    </Field>
                  </div>
                </fieldset>
                <Result state={productState} />
                <SaveButton pending={productPending}>
                  Salvar e usar item
                </SaveButton>
              </form>
            )}

            {pickerStep === "new" && pickerTarget.kind === "supplier" && (
              <form
                key={supplierState.successId ?? "new-receipt-supplier"}
                action={supplierAction}
                className="inventory-form receipt-picker-form"
              >
                <input type="hidden" name="entity" value="suppliers" />
                <input type="hidden" name="active" value="true" />
                <input
                  type="hidden"
                  name="reason"
                  value="Cadastro durante recebimento"
                />
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setPickerStep("choice")}
                >
                  ← Voltar
                </button>
                <fieldset disabled={supplierPending}>
                  <div className="form-grid">
                    <Field label="Nome do fornecedor" name="name" required />
                    <Field label="CNPJ" name="cnpj" maxLength={20} />
                    <Field
                      label="Telefone"
                      name="phone"
                      type="tel"
                      maxLength={30}
                    />
                    <Field label="Pessoa de contato" name="contact_name" />
                    <Field label="Endereço" name="address" maxLength={240} />
                  </div>
                </fieldset>
                <Result state={supplierState} />
                <SaveButton pending={supplierPending}>
                  Salvar e usar fornecedor
                </SaveButton>
              </form>
            )}
          </section>
        </div>
      )}
    </>
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
    registerLotOperation,
    requestId,
  );
  const v = (key: string, fallback = "") => state.values?.[key] ?? fallback;
  const canDispatch = !lot.expires_on || lot.expires_on >= today;
  const canProduce = canDispatch && lot.category_name === "Frutas recebidas";
  const [kind, setKind] = useState<LotOperation>(
    v(
      "kind",
      canProduce ? "production" : canDispatch ? "external_dispatch" : "loss",
    ) as LotOperation,
  );
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
            value={kind}
            onChange={(value) => setKind(value as LotOperation)}
          >
            {Object.entries(lotOperations).map(([value, label]) => (
              <option
                key={value}
                value={value}
                disabled={
                  (!canDispatch && value !== "loss") ||
                  (value === "production" && !canProduce)
                }
              >
                {label}
              </option>
            ))}
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
          {kind === "external_dispatch" && (
            <Field
              key="external-destination"
              label="Destino da saída"
              name="reason"
              required
              value={v("reason")}
              hint="Use para itens que realmente deixaram a fábrica sem entrar na produção."
            >
              <option value="">Selecione</option>
              {Object.entries(externalDestinations).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </Field>
          )}
        </div>
      </fieldset>
      {kind === "loss" && (
        <p className="muted text-sm">
          O sistema registrará automaticamente como produto vencido ou perda
          operacional, conforme a validade atual do lote.
        </p>
      )}
      {!canDispatch && (
        <p className="muted text-sm">
          Este lote está vencido e só pode registrar perda ou descarte.
        </p>
      )}
      {canDispatch && !canProduce && (
        <p className="muted text-sm">
          Somente lotes da categoria Frutas recebidas podem iniciar uma produção
          de polpa.
        </p>
      )}
      <Result state={state} />
      <SaveButton pending={pending} disabled={lot.quantity === 0}>
        {kind === "production"
          ? "Enviar para produção"
          : kind === "external_dispatch"
            ? "Registrar saída externa"
            : "Registrar perda / descarte"}
      </SaveButton>
    </form>
  );
}

export function CompleteProductionForm({
  productionId,
  requestId,
  now,
  variants,
  locations,
}: {
  productionId: string;
  requestId: string;
  now: string;
  variants: InventoryVariant[];
  locations: Location[];
}) {
  const { state, action, pending, operationId } = useStockAction(
    completeProduction,
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
      <input type="hidden" name="production_id" value={productionId} />
      <fieldset disabled={pending}>
        <legend className="sr-only">Produto final da produção</legend>
        <div className="form-grid">
          <Field
            label="Polpa produzida"
            name="variant_id"
            required
            value={v("variant_id")}
          >
            <option value="">Selecione</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.product_name}
                {!variant.is_default ? ` · ${variant.name}` : ""}
              </option>
            ))}
          </Field>
          <Field
            label="Freezer de destino"
            name="location_id"
            required
            value={v("location_id")}
          >
            <option value="">Selecione</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </Field>
          <Field
            label="Quantidade produzida"
            name="quantity"
            required
            inputMode="decimal"
            value={v("quantity")}
          />
          <Field label="Unidade" name="unit" required value={v("unit", "un")}>
            {Object.entries(units).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Field>
          <Field
            label="Peso líquido total (kg)"
            name="net_weight_kg"
            inputMode="decimal"
            value={v("net_weight_kg")}
            hint="Opcional quando o peso já estiver definido na apresentação."
          />
          <Field
            label="Data e hora de finalização"
            name="completed_at"
            type="datetime-local"
            required
            value={v("completed_at", now)}
            hint="Horário de Brasília. Não pode anteceder o início da produção."
          />
          <Field
            label="Validade da polpa"
            name="expires_on"
            type="date"
            required
            value={v("expires_on")}
          />
          <Field
            label="Observações da produção"
            name="notes"
            rows={4}
            maxLength={1000}
            value={v("notes")}
            hint="Opcional. Registre ocorrências relevantes do processamento."
          />
        </div>
      </fieldset>
      <Result state={state} />
      <SaveButton pending={pending}>Finalizar produção</SaveButton>
    </form>
  );
}
