"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  inviteMember,
  submitOperation,
  uploadReceipt,
  type OperationState,
} from "@/app/gestao/actions";
import {
  operationForms,
  type Field,
  type OperationForm,
} from "@/lib/operations/forms";
import type { Json } from "@/lib/inventory/types";
import type { OperationsModule } from "@/lib/operations/types";

export type Row = Record<string, Json | undefined>;
export type Snapshot = Record<string, Json | undefined>;
export function rows(snapshot: Snapshot, name: string): Row[] {
  const value = snapshot[name];
  return Array.isArray(value)
    ? value.filter(
        (row): row is Row =>
          Boolean(row) && typeof row === "object" && !Array.isArray(row),
      )
    : [];
}
function identifier(row: Row) {
  return String(row.id ?? row.user_id ?? "");
}
function label(row: Row) {
  const identity =
    row.name ??
    row.display_name ??
    row.description ??
    row.code ??
    row.reference ??
    row.product_name ??
    row.kind ??
    row.status ??
    "Registro";
  const detail =
    row.code && row.code !== identity
      ? ` · ${row.code}`
      : row.quantity !== undefined
        ? ` · ${row.quantity} ${row.unit ?? ""}`
        : row.amount !== undefined
          ? ` · R$ ${row.amount}`
          : "";
  return `${identity}${detail} · ${identifier(row).slice(0, 8)}`;
}
function Fields({
  fields,
  snapshot,
  prefix = "",
  onValue,
}: {
  fields: Field[];
  snapshot: Snapshot;
  prefix?: string;
  onValue?: (name: string, value: string) => void;
}) {
  return (
    <>
      {fields.map((field) =>
        field.fields ? (
          <Repeated
            key={field.name}
            field={field}
            snapshot={snapshot}
            prefix={prefix}
          />
        ) : (
          <label
            className="block space-y-1 text-sm font-medium"
            key={field.name}
          >
            <span>
              {field.label}
              {field.optional ? " (opcional)" : ""}
            </span>
            {field.source || field.options ? (
              <select
                name={`${prefix}${field.name}`}
                required={!field.optional}
                className="w-full rounded-lg border border-slate-300 bg-white p-3"
                onChange={(event) => onValue?.(field.name, event.target.value)}
              >
                <option value="">Selecione…</option>
                {(
                  field.options ??
                  rows(snapshot, field.source!).map((row) => [
                    identifier(row),
                    label(row),
                  ])
                )
                  .filter(
                    ([key]) =>
                      !(
                        field.name === "role" &&
                        key === "admin" &&
                        snapshot.role !== "admin"
                      ),
                  )
                  .map(([key, text]) => (
                    <option key={key} value={key}>
                      {text}
                    </option>
                  ))}
              </select>
            ) : field.type === "checkbox" ? (
              <input
                name={`${prefix}${field.name}`}
                type="checkbox"
                defaultChecked={
                  field.name === "active" || field.name === "required"
                }
                className="ml-2 size-5"
              />
            ) : (
              <input
                name={`${prefix}${field.name}`}
                type={field.type === "number" ? "text" : (field.type ?? "text")}
                inputMode={field.type === "number" ? "decimal" : undefined}
                required={!field.optional}
                maxLength={2000}
                className="w-full rounded-lg border border-slate-300 bg-white p-3"
              />
            )}
          </label>
        ),
      )}
    </>
  );
}
function Repeated({
  field,
  snapshot,
  prefix,
}: {
  field: Field;
  snapshot: Snapshot;
  prefix: string;
}) {
  const [count, setCount] = useState(1);
  const name = `${prefix}${field.name}`;
  return (
    <fieldset className="space-y-4 rounded-lg border border-slate-200 p-4 sm:col-span-2">
      <legend className="px-2 font-semibold">{field.label}</legend>
      <input type="hidden" name={`${name}.__count`} value={count} />
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="grid gap-3 border-b border-slate-100 pb-4 sm:grid-cols-2"
        >
          <Fields
            fields={field.fields!}
            snapshot={snapshot}
            prefix={`${name}.${index}.`}
          />
        </div>
      ))}
      <div className="flex gap-3">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={count >= 100}
          onClick={() => setCount(count + 1)}
        >
          Adicionar item
        </button>
        {count > 1 && (
          <button
            type="button"
            className="text-link"
            onClick={() => setCount(count - 1)}
          >
            Remover último
          </button>
        )}
      </div>
    </fieldset>
  );
}
function CommandForm({
  definition,
  module,
  snapshot,
}: {
  definition: OperationForm;
  module: OperationsModule;
  snapshot: Snapshot;
}) {
  const router = useRouter();
  const command = useRef("");
  const [state, setState] = useState<OperationState>({});
  const [pending, setPending] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const retryData = useRef<FormData | null>(null);
  const storageKey = `frutalize:${module}:${definition.action}:pending`;
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const entries = JSON.parse(raw) as [string, string][];
      const data = new FormData();
      for (const [key, value] of entries) data.set(key, value);
      retryData.current = data;
      command.current = String(data.get("command_id"));
      queueMicrotask(() => setUncertain(true));
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }, [storageKey]);
  const template = rows(snapshot, "templates").find(
    (row) => row.id === templateId,
  );
  const criteria = Array.isArray(template?.criteria)
    ? (template.criteria as Row[])
    : [];
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data =
      uncertain && retryData.current
        ? retryData.current
        : new FormData(event.currentTarget);
    command.current ||= crypto.randomUUID();
    data.set("command_id", command.current);
    data.set("module", module);
    data.set("action", definition.action);
    retryData.current = data;
    sessionStorage.setItem(storageKey, JSON.stringify([...data.entries()]));
    setPending(true);
    try {
      const result = await submitOperation(data);
      setState(result);
      setUncertain(Boolean(result.uncertain));
      if (!result.uncertain) {
        command.current = "";
        retryData.current = null;
        sessionStorage.removeItem(storageKey);
      }
      if (result.success) router.refresh();
    } catch {
      setState({
        error: "Conexão interrompida. Reenvie a operação com os mesmos dados.",
      });
      setUncertain(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer font-semibold">
        {definition.title}
      </summary>
      <form onSubmit={send} className="mt-4 space-y-4">
        {definition.description && (
          <p className="muted text-sm leading-6">{definition.description}</p>
        )}
        <fieldset
          disabled={pending || uncertain}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Fields
            fields={definition.fields}
            snapshot={snapshot}
            onValue={(name, value) =>
              name === "template_id" && setTemplateId(value)
            }
          />
          {criteria.map((criterion) => (
            <label key={String(criterion.key)} className="block text-sm">
              {String(criterion.label)}
              {criterion.type === "boolean" ? (
                <select
                  className="block w-full rounded border p-3"
                  name={`response.${criterion.key}`}
                  required={Boolean(criterion.required)}
                >
                  <option value="">Selecione…</option>
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </select>
              ) : (
                <input
                  className="block w-full rounded border p-3"
                  name={`response.${criterion.key}`}
                  required={Boolean(criterion.required)}
                  inputMode={criterion.type === "number" ? "decimal" : "text"}
                  maxLength={1000}
                />
              )}
            </label>
          ))}
          {definition.critical && (
            <label className="flex items-center gap-3 rounded border border-amber-300 bg-amber-50 p-3 sm:col-span-2">
              <input name="confirm" type="checkbox" required />
              Conferi os dados e confirmo esta operação.
            </label>
          )}
        </fieldset>
        {uncertain && (
          <p role="alert" className="notice">
            A confirmação está pendente. Os campos estão bloqueados para que a
            consulta seja reenviada com a mesma intenção.
          </p>
        )}
        {state.error && (
          <p role="alert" className="text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="notice">
            {state.success}
          </p>
        )}
        <button disabled={pending} className="btn btn-primary">
          {pending
            ? "Salvando…"
            : uncertain
              ? "Consultar resultado / reenviar"
              : definition.title}
        </button>
      </form>
    </details>
  );
}
function SpecialForm({
  kind,
  snapshot,
}: {
  kind: "invite" | "upload";
  snapshot: Snapshot;
}) {
  const router = useRouter();
  const [state, setState] = useState<OperationState>({});
  const [pending, setPending] = useState(false);
  const command = useRef("");
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    command.current ||= crypto.randomUUID();
    data.set("command_id", command.current);
    setPending(true);
    try {
      const result = await (kind === "invite"
        ? inviteMember(data)
        : uploadReceipt(data));
      setState(result);
      if (!result.uncertain) command.current = "";
      if (result.success) router.refresh();
    } catch {
      setState({
        error:
          "A resposta não foi confirmada. Confira o histórico antes de repetir.",
        uncertain: true,
      });
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer font-semibold">
        {kind === "invite"
          ? "Convidar pessoa por e-mail"
          : "Anexar documento privado"}
      </summary>
      <form onSubmit={send} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Fields
          snapshot={snapshot}
          fields={
            kind === "invite"
              ? [
                  { name: "display_name", label: "Nome" },
                  { name: "email", label: "E-mail", type: "email" },
                  {
                    name: "role",
                    label: "Papel",
                    options: [
                      ["collaborator", "Colaborador"],
                      ["manager", "Gestor"],
                      ...(snapshot.role === "admin"
                        ? ([["admin", "Administrador"]] as const)
                        : []),
                    ],
                  },
                  { name: "reason", label: "Motivo do convite" },
                ]
              : [
                  {
                    name: "receipt_id",
                    label: "Recebimento",
                    source: "receipts",
                  },
                  { name: "reason", label: "Descrição do documento" },
                ]
          }
        />
        {kind === "upload" && (
          <label className="text-sm">
            Arquivo (JPG, PNG ou PDF, até 10 MB)
            <input
              className="mt-2 block w-full"
              name="file"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              required
            />
          </label>
        )}
        {state.error && (
          <p role="alert" className="text-red-700 sm:col-span-2">
            {state.error}
            {state.id && ` Referência para vínculo: ${state.id}`}
          </p>
        )}
        {state.success && (
          <p role="status" className="notice sm:col-span-2">
            {state.success}
          </p>
        )}
        <button
          disabled={pending || Boolean(state.uncertain)}
          className="btn btn-primary sm:col-span-2"
        >
          {pending
            ? "Enviando…"
            : kind === "invite"
              ? "Enviar convite"
              : "Salvar documento"}
        </button>
      </form>
    </details>
  );
}

const tableDefinitions: Record<
  string,
  { title: string; columns: [string, string][] }
> = {
  counts: {
    title: "Sessões de contagem",
    columns: [
      ["id", "Referência"],
      ["status", "Situação"],
      ["created_at", "Abertura"],
    ],
  },
  count_lines: {
    title: "Lotes contados",
    columns: [
      ["lot_id", "Lote"],
      ["expected_quantity", "Saldo registrado"],
      ["counted_quantity", "Contagem"],
      ["difference", "Diferença"],
    ],
  },
  templates: {
    title: "Checklists versionados",
    columns: [
      ["name", "Nome"],
      ["revision", "Revisão"],
      ["created_at", "Criação"],
    ],
  },
  inspections: {
    title: "Inspeções",
    columns: [
      ["receipt_id", "Recebimento"],
      ["decision", "Decisão"],
      ["notes", "Observações"],
      ["created_at", "Registro"],
    ],
  },
  attachments: {
    title: "Documentos privados",
    columns: [
      ["receipt_id", "Recebimento"],
      ["mime_type", "Tipo"],
      ["size_bytes", "Tamanho"],
      ["created_at", "Registro"],
    ],
  },
  members: {
    title: "Equipe",
    columns: [
      ["display_name", "Nome"],
      ["role", "Papel"],
      ["active", "Acesso ativo"],
    ],
  },
  rules: {
    title: "Regras configuradas",
    columns: [
      ["name", "Nome"],
      ["kind", "Tipo"],
      ["threshold", "Limite"],
      ["active", "Ativa"],
    ],
  },
  readings: {
    title: "Leituras de temperatura",
    columns: [
      ["location_id", "Local"],
      ["value_c", "°C"],
      ["equipment", "Instrumento"],
      ["measured_at", "Medição"],
    ],
  },
  events: {
    title: "Alertas",
    columns: [
      ["rule_id", "Regra"],
      ["status", "Situação"],
      ["message", "Ocorrência"],
      ["created_at", "Registro"],
    ],
  },
  accounts: {
    title: "Contas",
    columns: [
      ["name", "Nome"],
      ["kind", "Tipo"],
    ],
  },
  titles: {
    title: "Contas a pagar e receber",
    columns: [
      ["description", "Descrição"],
      ["kind", "Tipo"],
      ["amount", "Valor"],
      ["remaining_amount", "Em aberto"],
      ["competence_on", "Competência"],
      ["due_on", "Vencimento"],
    ],
  },
  balances: {
    title: "Saldo registrado por conta",
    columns: [
      ["name", "Conta"],
      ["recorded_balance", "Saldo registrado"],
    ],
  },
  settlements: {
    title: "Baixas e estornos",
    columns: [
      ["title_id", "Título"],
      ["amount", "Valor"],
      ["paid_on", "Pagamento"],
      ["reversed_at", "Estorno"],
    ],
  },
  reconciliations: {
    title: "Conciliações",
    columns: [
      ["settlement_id", "Baixa"],
      ["external_reference", "Extrato"],
      ["created_at", "Registro"],
    ],
  },
  customers: {
    title: "Clientes",
    columns: [
      ["name", "Nome"],
      ["active", "Ativo"],
    ],
  },
  catalog: {
    title: "Catálogo comercial",
    columns: [
      ["name", "Oferta"],
      ["unit", "Unidade"],
      ["price", "Preço"],
      ["active", "Ativa"],
    ],
  },
  orders: {
    title: "Pedidos",
    columns: [
      ["id", "Pedido"],
      ["customer_id", "Cliente"],
      ["status", "Situação"],
      ["total_amount", "Total"],
      ["created_at", "Criação"],
    ],
  },
  lines: {
    title: "Itens de pedidos",
    columns: [
      ["id", "Item"],
      ["order_id", "Pedido"],
      ["name", "Produto"],
      ["quantity", "Quantidade"],
      ["unit_price", "Preço"],
    ],
  },
  reservations: {
    title: "Reservas por lote",
    columns: [
      ["order_id", "Pedido"],
      ["lot_id", "Lote"],
      ["quantity", "Quantidade"],
      ["status", "Situação"],
    ],
  },
  shipment_lines: {
    title: "Lotes expedidos",
    columns: [
      ["id", "Referência"],
      ["lot_id", "Lote"],
      ["quantity", "Quantidade"],
      ["created_at", "Expedição"],
    ],
  },
  returns: {
    title: "Devoluções registradas",
    columns: [
      ["shipment_line_id", "Expedição"],
      ["quantity", "Quantidade"],
      ["reason", "Motivo"],
    ],
  },
  entries: {
    title: "Meus apontamentos",
    columns: [
      ["kind", "Evento"],
      ["occurred_at", "Horário informado"],
      ["created_at", "Registro"],
      ["notes", "Observações"],
      ["reason", "Correção"],
    ],
  },
};
const translations: Record<string, string> = {
  admin: "Administrador",
  manager: "Gestor",
  collaborator: "Colaborador",
  open: "Aberto",
  approved: "Aprovado",
  completed: "Concluído",
  cancelled: "Cancelado",
  reserved: "Reservado",
  shipped: "Expedido",
  accepted: "Aceito",
  rejected: "Rejeitado",
  payable: "A pagar",
  receivable: "A receber",
  cash: "Caixa",
  bank: "Banco",
  start: "Início",
  pause: "Pausa",
  resume: "Retorno",
  end: "Fim",
  minimum_stock: "Estoque mínimo",
  expiry: "Validade",
  temperature: "Temperatura",
  missing_reading: "Sem leitura",
  resolved: "Resolvido",
};
function display(value: Json | undefined, snapshot: Snapshot): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  const text = String(value);
  if (translations[text]) return translations[text];
  if (/^\d{4}-\d{2}-\d{2}/.test(text))
    return text.length > 10
      ? new Date(text).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        })
      : text.split("-").reverse().join("/");
  if (/^[a-f0-9-]{36}$/i.test(text)) {
    for (const list of Object.values(snapshot))
      if (Array.isArray(list)) {
        const row = list.find(
          (item) =>
            item &&
            typeof item === "object" &&
            !Array.isArray(item) &&
            (item.id === text || item.user_id === text),
        ) as Row | undefined;
        if (
          row &&
          (row.name || row.display_name || row.description || row.code)
        )
          return String(
            row.name ?? row.display_name ?? row.description ?? row.code,
          );
      }
    return text.slice(0, 8);
  }
  return text;
}
export function SnapshotTables({
  snapshot,
  only,
  documentBasePath = "/gestao/documento",
}: {
  snapshot: Snapshot;
  only?: string[];
  documentBasePath?: string;
}) {
  return (
    <div className="space-y-5">
      {Object.entries(tableDefinitions)
        .filter(
          ([list]) =>
            (!only || only.includes(list)) && snapshot[list] !== undefined,
        )
        .map(([list, definition]) => (
          <section className="panel overflow-hidden" key={list}>
            <div className="panel-heading">
              <h2>{definition.title}</h2>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {definition.columns.map(([key, title]) => (
                      <th key={key}>{title}</th>
                    ))}
                    {list === "attachments" && <th>Documento</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows(snapshot, list).map((row, index) => (
                    <tr key={identifier(row) || index}>
                      {definition.columns.map(([key]) => (
                        <td key={key}>{display(row[key], snapshot)}</td>
                      ))}
                      {list === "attachments" && (
                        <td>
                          <a
                            className="text-link"
                            target="_blank"
                            rel="noopener noreferrer"
                            href={`${documentBasePath}/${row.id}`}
                          >
                            Abrir
                          </a>
                        </td>
                      )}
                    </tr>
                  ))}
                  {!rows(snapshot, list).length && (
                    <tr>
                      <td
                        colSpan={definition.columns.length + 1}
                        className="muted py-6"
                      >
                        Nenhum registro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))}
    </div>
  );
}
export function OperationsWorkspace({
  module,
  snapshot,
  documentBasePath,
}: {
  module: OperationsModule;
  snapshot: Snapshot;
  documentBasePath?: string;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 lg:grid-cols-2">
        {operationForms[module].map((definition) => (
          <CommandForm
            definition={definition}
            module={module}
            snapshot={snapshot}
            key={definition.action}
          />
        ))}
        {module === "staff" && (
          <SpecialForm kind="invite" snapshot={snapshot} />
        )}
        {module === "receiving" && (
          <SpecialForm kind="upload" snapshot={snapshot} />
        )}
      </div>
      <SnapshotTables snapshot={snapshot} documentBasePath={documentBasePath} />
    </div>
  );
}
