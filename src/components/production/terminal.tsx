"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  loadTerminalSnapshot,
  lockTerminal,
  sendProductionCommand,
} from "@/app/terminal/actions";
import { dateTime, quantity } from "@/lib/inventory/format";
import type { Json } from "@/lib/inventory/types";
import {
  productionElapsedSeconds,
  type ProductionCommand,
  type TerminalRun,
  type TerminalSnapshot,
} from "@/lib/production/ui-types";
import { OrderConfiguration } from "./order-configuration";

const states: Record<string, string> = {
  preparing: "Em preparação",
  configured: "Configurada",
  in_progress: "Em produção",
  paused: "Pausada",
  awaiting_review: "Aguardando conferência final",
  completed: "Finalizada",
  cancelled: "Cancelada",
};
function clock(seconds: number) {
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function restoreCommand(
  value: string | null,
  actorId: string,
): ProductionCommand | null {
  try {
    const stored = JSON.parse(value ?? "null");
    return stored?.actorId === actorId &&
      stored.command?.commandId &&
      (stored.command?.runId || stored.command?.kind === "create")
      ? stored.command
      : null;
  } catch {
    return null;
  }
}

export function ProductionTerminal({
  initial,
  initialRunId,
  preview = false,
}: {
  initial: TerminalSnapshot;
  initialRunId?: string;
  preview?: boolean;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [runId, setRunId] = useState(initialRunId ?? "");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<ProductionCommand | null>(null);
  const [busy, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.parse(initial.serverTime));
  const [online, setOnline] = useState(true);
  const [dialog, setDialog] = useState<
    "pause" | "issue" | "complete" | "create" | "cancel" | null
  >(null);
  const inFlight = useRef(false),
    serverOffset = useRef(0);
  const storageKey = `frutalize.production.pending.${initial.actor.id}`;
  const canManage = ["admin", "manager"].includes(snapshot.actor.role);
  const activeRuns = snapshot.runs.filter(
    (item) =>
      item.status === "in_progress" && item.operational_status !== "cancelled",
  );
  const run = snapshot.runs.find((item) => item.id === runId);
  const step = run?.procedure?.steps.find(
    (item) => item.phase === run.phase && item.step === run.step,
  );
  const ownRun = run?.operator_id === snapshot.actor.id;
  const disabled = busy || Boolean(pending) || preview;

  useEffect(() => {
    if (preview) return;
    serverOffset.current = Date.parse(initial.serverTime) - Date.now();
    const command = restoreCommand(
      sessionStorage.getItem(storageKey),
      initial.actor.id,
    );
    const restoreTimer = window.setTimeout(() => {
      if (command) {
        setPending(command);
        setRunId(command.runId ?? "");
        setMessage(
          "Há uma confirmação pendente. Consulte o mesmo comando antes de continuar.",
        );
      }
    }, 0);
    const connectivity = () => setOnline(navigator.onLine);
    const timer = window.setInterval(() => {
      setNow(Date.now() + serverOffset.current);
    }, 1000);
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    return () => {
      window.clearTimeout(restoreTimer);
      window.clearInterval(timer);
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
    };
  }, [initial.actor.id, initial.serverTime, preview, storageKey]);

  function dispatch(
    kind: string,
    payload: Record<string, Json | undefined>,
    target: TerminalRun | undefined = run,
    retry?: ProductionCommand,
  ) {
    if (preview || inFlight.current || (!retry && pending)) return;
    const command: ProductionCommand = retry ?? {
      commandId: crypto.randomUUID(),
      runId: kind === "create" ? null : (target?.id ?? crypto.randomUUID()),
      expectedRevision: kind === "create" ? 0 : (target?.revision ?? 0),
      kind,
      payload,
    };
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ actorId: snapshot.actor.id, command }),
    );
    setPending(command);
    inFlight.current = true;
    setMessage("");
    startTransition(async () => {
      try {
        const result = await sendProductionCommand(command);
        if (result.snapshot) {
          const updated = result.snapshot;
          setSnapshot((current) => ({
            ...current,
            runs: [
              updated,
              ...current.runs.filter((item) => item.id !== updated.id),
            ],
          }));
          setRunId(updated.id);
        }
        sessionStorage.removeItem(storageKey);
        setPending(null);
        if (result.ok) {
          setDialog(null);
          setMessage(
            command.kind === "complete"
              ? "Produção finalizada e lote registrado no estoque."
              : "Registro confirmado pelo servidor.",
          );
        } else
          setMessage(
            result.code === "CONFLICT"
              ? "Outra tela alterou esta ordem. O estado atual foi carregado; confira a instrução antes de agir novamente."
              : (result.message ??
                  "Operação recusada. Confira o estado da ordem."),
          );
      } catch {
        setMessage(
          "A resposta não chegou. A confirmação pode ter sido registrada. Use Consultar confirmação para reenviar o mesmo comando com segurança.",
        );
      } finally {
        inFlight.current = false;
      }
    });
  }
  function refresh() {
    if (preview || disabled) return;
    startTransition(async () => {
      try {
        const current = await loadTerminalSnapshot();
        serverOffset.current = Date.parse(current.serverTime) - Date.now();
        setSnapshot(current);
        setMessage("Estado atualizado.");
      } catch {
        setMessage(
          "Não foi possível atualizar. Confira a conexão ou entre novamente.",
        );
      }
    });
  }

  return (
    <div className="terminal-shell">
      <header className="terminal-topbar">
        <div className="terminal-brand">
          <span className="terminal-brand-mark" aria-hidden="true">
            F
          </span>
          <div>
            <strong>Frutalize · Produção</strong>
            <span>{snapshot.actor.name}</span>
          </div>
        </div>
        <div className="terminal-toolbar">
          {preview && (
            <span className="badge">Prévia fictícia · somente leitura</span>
          )}
          {!preview && snapshot.actor.role === "admin" && (
            <Link className="btn btn-secondary" href="/dashboard/producao">
              Dashboard
            </Link>
          )}
          <span className={`badge ${online ? "badge-green" : "badge-danger"}`}>
            {online ? "Online" : "Sem conexão"}
          </span>
          <button
            className="btn btn-secondary"
            onClick={refresh}
            disabled={disabled}
          >
            Atualizar
          </button>
          {!preview && (
            <form action={lockTerminal}>
              <button className="btn btn-secondary">
                Trocar operador / sair
              </button>
            </form>
          )}
        </div>
      </header>
      {(message || pending) && (
        <div
          className="terminal-message terminal-banner"
          role="status"
          aria-live="polite"
        >
          <p>{busy ? "Aguardando confirmação do servidor…" : message}</p>
          {pending && !busy && (
            <button
              className="btn btn-primary mt-3"
              onClick={() =>
                dispatch(pending.kind, pending.payload, undefined, pending)
              }
            >
              Consultar confirmação
            </button>
          )}
        </div>
      )}
      {!run ? (
        <main className="terminal-queue">
          <div className="terminal-queue-heading">
            <div>
              <span>Fila de produção</span>
              <h1>Selecione uma ordem</h1>
              <p>
                As instruções são vinculadas à revisão aprovada para cada ordem.
              </p>
            </div>
            <div className="terminal-queue-actions">
              <div className="terminal-count">
                <strong>{activeRuns.length}</strong>
                <span>
                  {activeRuns.length === 1 ? "ordem na fila" : "ordens na fila"}
                </span>
              </div>
              {canManage && (
                <button
                  className="terminal-btn terminal-btn-primary"
                  onClick={() => setDialog("create")}
                  disabled={disabled}
                >
                  Nova ordem
                </button>
              )}
            </div>
          </div>
          <div className="terminal-order-grid">
            {activeRuns.map((item) => (
              <button
                key={item.id}
                className="terminal-order-card"
                onClick={() => setRunId(item.id)}
                disabled={disabled}
              >
                <span
                  className="terminal-order-status"
                  data-status={item.operational_status}
                >
                  {states[item.operational_status] ?? item.operational_status}
                </span>
                <h2>{item.code}</h2>
                <p>
                  {item.procedure?.name ?? "Procedimento ainda não vinculado"}
                </p>
                <dl>
                  <div>
                    <dt>Responsável</dt>
                    <dd>{item.operator_name ?? "Aguardando identificação"}</dd>
                  </div>
                  <div>
                    <dt>Instrução</dt>
                    <dd>
                      {item.phase}.{item.step}
                    </dd>
                  </div>
                </dl>
                <span className="terminal-order-open">Abrir ordem →</span>
              </button>
            ))}
          </div>
          {activeRuns.length === 0 && (
            <div className="terminal-empty">
              <h2>Nenhuma ordem aguardando</h2>
              <p>
                O responsável pode criar uma ordem com procedimento, perfil e
                regra de qualidade aprovados.
              </p>
            </div>
          )}
        </main>
      ) : (
        <main className="terminal-workspace">
          <div className="terminal-order-header">
            <button
              className="terminal-back"
              onClick={() => setRunId("")}
              disabled={disabled}
            >
              ← Fila
            </button>
            <div className="terminal-order-title">
              <strong>{run.code}</strong>
              <span>
                {states[run.operational_status] ?? run.operational_status}
              </span>
            </div>
            <div className="terminal-order-meta">
              <strong>{run.operator_name ?? "Sem responsável"}</strong>
              <span>
                Tempo ativo {clock(productionElapsedSeconds(run, now))}
              </span>
            </div>
          </div>
          {run.status === "completed" ||
          run.operational_status === "cancelled" ? (
            <section className="terminal-empty">
              <h1>
                {run.operational_status === "cancelled"
                  ? "Ordem cancelada"
                  : "Produção finalizada"}
              </h1>
              <p>O histórico e os vínculos dos lotes foram preservados.</p>
              <button className="btn btn-primary" onClick={() => setRunId("")}>
                Voltar à fila
              </button>
            </section>
          ) : (
            <div className="terminal-guide">
              <section className="terminal-guide-main">
                {!run.procedure ? (
                  <>
                    <h1>Vincule um procedimento aprovado</h1>
                    <p className="terminal-instruction">
                      Esta ordem não possui instruções aprovadas. Chame o
                      responsável para selecionar as revisões aplicáveis.
                    </p>
                    {canManage && (
                      <OrderConfiguration
                        snapshot={snapshot}
                        busy={disabled}
                        onSubmit={(payload) => dispatch("configure", payload)}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <div className="terminal-step-labels">
                      <span>
                        {run.procedure.name} · Revisão {run.procedure.revision}
                      </span>
                      <span>
                        Instrução {run.phase}.{run.step}
                      </span>
                    </div>
                    <h1>
                      {run.operational_status === "awaiting_review"
                        ? "Confira e finalize a produção"
                        : (step?.title ?? "Aguardando conferência")}
                    </h1>
                    <p className="terminal-instruction">
                      {run.operational_status === "awaiting_review"
                        ? "Confira as quantidades reais e o local de armazenamento antes de registrar o lote acabado."
                        : step?.instruction}
                    </p>
                    {!ownRun ? (
                      <div className="terminal-message">
                        <p>
                          {run.operator_name
                            ? `Responsabilidade atual: ${run.operator_name}. Assuma a ordem com sua própria identificação para registrar ações.`
                            : "Assuma a responsabilidade para iniciar os registros desta ordem."}
                        </p>
                        <button
                          className="terminal-btn terminal-btn-primary mt-4"
                          disabled={disabled}
                          onClick={() =>
                            dispatch("claim", {
                              reason: "Assumir responsabilidade no terminal",
                            })
                          }
                        >
                          Assumir como {snapshot.actor.name}
                        </button>
                      </div>
                    ) : (
                      <>
                        {run.operational_status === "paused" && (
                          <p className="notice">
                            Produção pausada. Resolva os desvios que bloqueiam a
                            ordem antes de retomar.
                          </p>
                        )}
                        {step &&
                          ["quality", "release"].includes(step.kind) &&
                          run.operational_status !== "awaiting_review" && (
                            <QualityForm
                              run={run}
                              snapshot={snapshot}
                              disabled={disabled}
                              onSubmit={(payload) =>
                                dispatch("quality_check", payload)
                              }
                            />
                          )}
                        <div className="terminal-guide-actions">
                          {run.operational_status === "awaiting_review" ? (
                            <button
                              className="terminal-btn terminal-btn-primary"
                              disabled={disabled}
                              onClick={() => setDialog("complete")}
                            >
                              Conferir finalização
                            </button>
                          ) : (
                            <button
                              className="terminal-btn terminal-btn-primary"
                              disabled={
                                disabled ||
                                run.operational_status === "paused" ||
                                !step
                              }
                              onClick={() =>
                                dispatch("confirm_step", {
                                  phase: run.phase,
                                  step: run.step,
                                })
                              }
                            >
                              {step?.kind === "finish"
                                ? "Confirmar última instrução"
                                : "Confirmar instrução e avançar"}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
                <div className="terminal-safetyActions">
                  <button
                    className="terminal-btn terminal-btn-muted"
                    disabled={disabled || !ownRun}
                    onClick={() =>
                      run.operational_status === "paused"
                        ? dispatch("resume", {})
                        : setDialog("pause")
                    }
                  >
                    {run.operational_status === "paused"
                      ? "Retomar"
                      : "Pausar em segurança"}
                  </button>
                  <button
                    className="terminal-btn terminal-btn-muted"
                    disabled={disabled || !ownRun}
                    onClick={() => setDialog("issue")}
                  >
                    Informar problema / chamar responsável
                  </button>
                  {canManage && (
                    <button
                      className="btn btn-secondary"
                      disabled={disabled}
                      onClick={() => setDialog("cancel")}
                    >
                      Cancelar ordem
                    </button>
                  )}
                </div>
              </section>
              <aside className="terminal-order-summary">
                <span>Dados da ordem</span>
                <h2>{run.code}</h2>
                <dl>
                  {run.inputs.map((input, index) => (
                    <div key={`${input.lot_id}-${index}`}>
                      <dt>
                        {input.product_name} · {input.code}
                      </dt>
                      <dd>{quantity(Number(input.quantity), input.unit)}</dd>
                    </div>
                  ))}
                </dl>
                {run.profile && (
                  <div className="terminal-section">
                    <h3 className="font-semibold">
                      {run.profile.name} · Rev. {run.profile.revision}
                    </h3>
                    {run.profile.parameters.map((parameter) => (
                      <p key={parameter.name} className="mt-2 text-sm">
                        {parameter.name}:{" "}
                        <strong>
                          {quantity(Number(parameter.value), parameter.unit)}
                        </strong>
                        <br />
                        <span className="muted">
                          Limites {quantity(Number(parameter.min))} a{" "}
                          {quantity(Number(parameter.max), parameter.unit)} ·{" "}
                          {parameter.source}
                        </span>
                      </p>
                    ))}
                  </div>
                )}
                {run.qualityChecks?.length > 0 && (
                  <div className="terminal-section">
                    <h3 className="font-semibold">Última medição</h3>
                    {run.qualityChecks.slice(-1).map((check) => (
                      <p key={check.id} className="mt-2 text-sm">
                        {quantity(Number(check.net), check.unit)} ·{" "}
                        <strong>
                          {check.passed ? "Conforme" : "Fora da regra"}
                        </strong>
                        <br />
                        {check.instrument_name} · {dateTime(check.created_at)}
                      </p>
                    ))}
                  </div>
                )}
                {run.nonconformities?.length > 0 && (
                  <div className="terminal-section">
                    <h3 className="font-semibold">Desvios</h3>
                    {run.nonconformities.map((item) => (
                      <div key={item.id} className="mt-3 text-sm">
                        <p>
                          <strong>
                            {item.status === "closed"
                              ? "Encerrado"
                              : "Em tratamento"}
                          </strong>
                          : {item.reason}
                        </p>
                        {item.decision && <p>{item.decision}</p>}
                        {canManage && item.status !== "closed" && (
                          <form
                            className="field mt-3"
                            action={(data) =>
                              dispatch("resolve_nonconformity", {
                                id: item.id,
                                status:
                                  item.status === "open"
                                    ? "contained"
                                    : item.status === "contained"
                                      ? "assessed"
                                      : "closed",
                                reason: String(data.get("reason")),
                                decision: String(data.get("decision")),
                              })
                            }
                          >
                            <label htmlFor={`nc-${item.id}`}>
                              Decisão e destino do produto
                            </label>
                            <input
                              id={`nc-${item.id}`}
                              name="decision"
                              minLength={3}
                              maxLength={1000}
                              required
                            />
                            <label
                              htmlFor={`reason-${item.id}`}
                              className="mt-2"
                            >
                              Justificativa
                            </label>
                            <input
                              id={`reason-${item.id}`}
                              name="reason"
                              minLength={3}
                              maxLength={1000}
                              required
                            />
                            <button
                              className="btn btn-secondary mt-2"
                              disabled={disabled}
                            >
                              Registrar{" "}
                              {item.status === "open"
                                ? "contenção"
                                : item.status === "contained"
                                  ? "avaliação"
                                  : "encerramento"}
                            </button>
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </aside>
            </div>
          )}
        </main>
      )}
      {dialog && (
        <div className="terminal-dialog-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="production-dialog-title"
            className="terminal-dialog"
          >
            <h2 id="production-dialog-title">
              {
                {
                  pause: "Pausar a produção",
                  issue: "Informar problema",
                  complete: "Finalizar e registrar lote",
                  create: "Nova ordem",
                  cancel: "Cancelar ordem",
                }[dialog]
              }
            </h2>
            {dialog === "create" ? (
              <OrderConfiguration
                snapshot={snapshot}
                create
                busy={disabled}
                onSubmit={(payload) => dispatch("create", payload)}
              />
            ) : dialog === "complete" ? (
              <CompleteForm
                snapshot={snapshot}
                disabled={disabled}
                onSubmit={(payload) => dispatch("complete", payload)}
              />
            ) : (
              <form
                className="inventory-form mt-4"
                action={(data) => {
                  const reason = String(data.get("reason") ?? "").trim();
                  if (dialog === "pause")
                    dispatch("pause", {
                      reason,
                      safe_point_confirmed:
                        data.get("safe_point_confirmed") === "on",
                    });
                  else if (dialog === "issue") dispatch("issue", { reason });
                  else
                    dispatch("cancel", {
                      reason,
                      disposition: String(data.get("disposition")),
                      destination: String(data.get("destination")),
                    });
                }}
              >
                <div className="field">
                  <label htmlFor="production-reason">Descreva o motivo</label>
                  <textarea
                    id="production-reason"
                    name="reason"
                    required
                    minLength={3}
                    maxLength={1000}
                    rows={3}
                  />
                </div>
                {dialog === "pause" && (
                  <label className="terminal-confirmation">
                    <input
                      type="checkbox"
                      name="safe_point_confirmed"
                      required
                    />{" "}
                    A operação física está em ponto seguro conforme o
                    procedimento. O sistema registra a pausa e não comanda a
                    máquina.
                  </label>
                )}
                {dialog === "cancel" && (
                  <>
                    <div className="field">
                      <label htmlFor="disposition">
                        Tratamento dos insumos já consumidos
                      </label>
                      <select id="disposition" name="disposition" required>
                        <option value="">Selecione</option>
                        <option value="segregated">Segregados</option>
                        <option value="discarded">
                          Descartados conforme decisão autorizada
                        </option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="cancel-destination">
                        Destino e responsável pela decisão
                      </label>
                      <input
                        id="cancel-destination"
                        name="destination"
                        required
                        minLength={3}
                        maxLength={1000}
                      />
                    </div>
                    <p className="muted text-sm">
                      O código da ordem será preservado. O cancelamento não
                      devolve saldo automaticamente.
                    </p>
                  </>
                )}
                <button
                  className="terminal-btn terminal-btn-primary"
                  disabled={disabled}
                >
                  Confirmar registro
                </button>
              </form>
            )}
            <button
              className="btn btn-secondary mt-4"
              onClick={() => setDialog(null)}
              disabled={busy}
            >
              Voltar
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

export function QualityForm({
  run,
  snapshot,
  disabled,
  onSubmit,
}: {
  run: TerminalRun;
  snapshot: TerminalSnapshot;
  disabled: boolean;
  onSubmit: (payload: Record<string, Json>) => void;
}) {
  if (!run.qualitySpec)
    return (
      <p className="notice">
        Não há regra de qualidade vinculada. Chame o responsável.
      </p>
    );
  const spec = run.qualitySpec;
  return (
    <form
      className="inventory-form terminal-section"
      action={(data) =>
        onSubmit({
          gross: Number(data.get("gross")),
          tare: Number(spec.tare),
          unit: spec.unit,
          instrument_id: String(data.get("instrument_id")),
        })
      }
    >
      <p className="font-semibold">
        {spec.name} · Rev. {spec.revision}
      </p>
      <p className="muted text-sm">
        Peso líquido: {quantity(Number(spec.minimum))} a{" "}
        {quantity(Number(spec.maximum), spec.unit)}. Tara aprovada:{" "}
        {quantity(Number(spec.tare), spec.unit)}.
      </p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="quality-gross">Peso bruto medido ({spec.unit})</label>
          <input
            id="quality-gross"
            name="gross"
            type="number"
            min="0"
            step="0.001"
            inputMode="decimal"
            required
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label htmlFor="quality-instrument">Instrumento utilizado</label>
          <select
            id="quality-instrument"
            name="instrument_id"
            required
            disabled={disabled}
          >
            <option value="">Selecione</option>
            {snapshot.instruments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button className="terminal-btn terminal-btn-muted" disabled={disabled}>
        Registrar medição
      </button>
    </form>
  );
}
export function CompleteForm({
  snapshot,
  disabled,
  onSubmit,
}: {
  snapshot: TerminalSnapshot;
  disabled: boolean;
  onSubmit: (payload: Record<string, Json>) => void;
}) {
  return (
    <form
      className="inventory-form mt-5"
      action={(data) =>
        onSubmit({
          location_id: String(data.get("location_id")),
          quantity: Number(data.get("quantity")),
          unit: String(data.get("unit")),
          expires_on: String(data.get("expires_on")),
          net_weight_kg: data.get("net_weight_kg")
            ? Number(data.get("net_weight_kg"))
            : null,
          notes: String(data.get("notes") ?? ""),
          loss_notes: String(data.get("loss_notes") ?? ""),
        })
      }
    >
      <div className="form-grid">
        <div className="field">
          <label htmlFor="complete-quantity">Quantidade real produzida</label>
          <input
            id="complete-quantity"
            name="quantity"
            required
            type="number"
            min="0.001"
            step="0.001"
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label htmlFor="complete-unit">Unidade da quantidade</label>
          <select id="complete-unit" name="unit" required disabled={disabled}>
            {[
              ["un", "Unidades"],
              ["kg", "Quilogramas"],
              ["g", "Gramas"],
              ["pct", "Pacotes"],
              ["cx", "Caixas"],
              ["l", "Litros"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="complete-location">Freezer de destino</label>
          <select
            id="complete-location"
            name="location_id"
            required
            disabled={disabled}
          >
            <option value="">Selecione</option>
            {snapshot.locations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="complete-expiry">
            Validade aprovada para este lote
          </label>
          <input
            id="complete-expiry"
            name="expires_on"
            required
            type="date"
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label htmlFor="complete-weight">
            Peso líquido real total (kg), se medido
          </label>
          <input
            id="complete-weight"
            name="net_weight_kg"
            type="number"
            min="0.001"
            step="0.001"
            disabled={disabled}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="complete-loss">Perdas e rendimento observados</label>
        <textarea
          id="complete-loss"
          name="loss_notes"
          maxLength={1000}
          disabled={disabled}
        />
      </div>
      <div className="field">
        <label htmlFor="complete-notes">Observações do lote acabado</label>
        <textarea
          id="complete-notes"
          name="notes"
          maxLength={1000}
          disabled={disabled}
        />
      </div>
      <label className="terminal-confirmation">
        <input type="checkbox" required disabled={disabled} /> Conferi as
        quantidades, o produto vinculado, a validade e o freezer. Confirmo o
        registro definitivo deste lote.
      </label>
      <button className="terminal-btn terminal-btn-primary" disabled={disabled}>
        Finalizar produção e registrar lote
      </button>
    </form>
  );
}
