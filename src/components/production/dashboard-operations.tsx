"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  loadTerminalSnapshot,
  sendProductionCommand,
} from "@/app/terminal/actions";
import { dateTime, quantity } from "@/lib/inventory/format";
import type { Json } from "@/lib/inventory/types";
import type {
  ProductionCommand,
  TerminalSnapshot,
} from "@/lib/production/ui-types";
import { OrderConfiguration } from "./order-configuration";
import { CompleteForm, QualityForm } from "./terminal";
import styles from "./dashboard-operations.module.css";

type Action =
  | "create"
  | "configure"
  | "claim"
  | "confirm_step"
  | "quality_check"
  | "pause"
  | "resume"
  | "issue"
  | "resolve_nonconformity"
  | "complete"
  | "cancel";

export function DashboardOperations({
  initial,
  runId,
}: {
  initial: TerminalSnapshot;
  runId?: string;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initial);
  const [selected, setSelected] = useState<Action | null>(
    runId ? null : "create",
  );
  const [pending, setPending] = useState<ProductionCommand | null>(null);
  const [message, setMessage] = useState("");
  const [busy, startTransition] = useTransition();
  const inFlight = useRef(false);
  const run = snapshot.runs.find((item) => item.id === runId);
  const step = run?.procedure?.steps.find(
    (item) => item.phase === run.phase && item.step === run.step,
  );
  const ownRun = run?.operator_id === snapshot.actor.id;
  const storageKey = `frutalize.dashboard.production.pending.${snapshot.actor.id}`;
  const disabled = busy || Boolean(pending);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        sessionStorage.getItem(storageKey) ?? "null",
      ) as {
        actorId?: string;
        command?: ProductionCommand;
      } | null;
      if (stored?.actorId === initial.actor.id && stored.command?.commandId) {
        const command = stored.command;
        const timer = window.setTimeout(() => {
          setPending(command);
          setMessage(
            "Há uma confirmação pendente. Consulte o mesmo comando antes de continuar.",
          );
        }, 0);
        return () => window.clearTimeout(timer);
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }, [initial.actor.id, storageKey]);

  function send(
    kind: Action,
    payload: Record<string, Json | undefined> = {},
    retry?: ProductionCommand,
  ) {
    if (inFlight.current || (pending && !retry)) return;
    const command: ProductionCommand = retry ?? {
      commandId: crypto.randomUUID(),
      runId: kind === "create" ? null : (run?.id ?? null),
      expectedRevision: kind === "create" ? 0 : (run?.revision ?? 0),
      kind,
      payload,
    };
    if (kind !== "create" && !command.runId) return;
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ actorId: snapshot.actor.id, command }),
    );
    setPending(command);
    setMessage("");
    inFlight.current = true;
    startTransition(async () => {
      try {
        const result = await sendProductionCommand(command);
        if (result.snapshot) {
          setSnapshot((current) => ({
            ...current,
            runs: [
              result.snapshot!,
              ...current.runs.filter((item) => item.id !== result.snapshot!.id),
            ],
          }));
        }
        sessionStorage.removeItem(storageKey);
        setPending(null);
        setMessage(
          result.ok
            ? "Registro confirmado pelo servidor."
            : result.code === "CONFLICT"
              ? "A ordem mudou em outra tela. Confira o estado atualizado antes de agir novamente."
              : (result.message ?? "Operação recusada."),
        );
        if (result.ok) {
          setSelected(null);
          router.refresh();
          if (kind === "create" && result.snapshot?.id)
            router.push(`/dashboard/producao/${result.snapshot.id}`);
        }
      } catch {
        setMessage(
          "A resposta não chegou. A operação pode ter sido registrada. Consulte a mesma confirmação antes de agir novamente.",
        );
      } finally {
        inFlight.current = false;
      }
    });
  }

  function refresh() {
    if (disabled) return;
    startTransition(async () => {
      try {
        setSnapshot(await loadTerminalSnapshot());
        router.refresh();
        setMessage("Dados atualizados.");
      } catch {
        setMessage("Não foi possível atualizar os dados da produção.");
      }
    });
  }

  if (runId && !run) return null;

  return (
    <section
      className={styles.shell}
      aria-label={
        run ? "Operação da ordem no dashboard" : "Nova ordem no dashboard"
      }
    >
      <div className={styles.heading}>
        <div>
          <p className="eyebrow">Operação administrativa</p>
          <h2>{run ? `Ordem ${run.code}` : "Criar ordem de produção"}</h2>
          <p className="muted">
            Os registros usam a mesma ordem e as mesmas regras do terminal.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={refresh}
          disabled={disabled}
        >
          Atualizar
        </button>
      </div>
      {(message || pending) && (
        <div className="notice" role="status" aria-live="polite">
          <p>{busy ? "Aguardando confirmação do servidor…" : message}</p>
          {pending && !busy && (
            <button
              className="btn btn-primary mt-3"
              type="button"
              onClick={() =>
                send(pending.kind as Action, pending.payload, pending)
              }
            >
              Consultar confirmação
            </button>
          )}
        </div>
      )}
      {run ? (
        <div className={styles.grid}>
          <div className={styles.main}>
            <div className={styles.facts}>
              <div>
                <span>Situação</span>
                <strong>{run.operational_status.replaceAll("_", " ")}</strong>
              </div>
              <div>
                <span>Responsável</span>
                <strong>{run.operator_name ?? "Não atribuído"}</strong>
              </div>
              <div>
                <span>Etapa</span>
                <strong>
                  {run.phase}.{run.step}
                </strong>
              </div>
              <div>
                <span>Atualizada</span>
                <strong>{dateTime(run.updated_at)}</strong>
              </div>
            </div>
            {run.status !== "completed" &&
              run.operational_status !== "cancelled" && (
                <>
                  <div className={styles.currentStep}>
                    <p className="eyebrow">
                      Instrução vigente · {run.phase}.{run.step}
                    </p>
                    <h3>
                      {step?.title ??
                        "Aguardando configuração ou conferência final"}
                    </h3>
                    <p>
                      {step?.instruction ??
                        "Consulte as revisões aprovadas e as medições antes de prosseguir."}
                    </p>
                  </div>
                  <div className={styles.actions} aria-label="Ações da ordem">
                    {!run.procedure && (
                      <button
                        className="btn btn-primary"
                        disabled={disabled}
                        onClick={() => setSelected("configure")}
                      >
                        Vincular revisões
                      </button>
                    )}
                    {!ownRun && (
                      <button
                        className="btn btn-primary"
                        disabled={disabled}
                        onClick={() =>
                          send("claim", {
                            reason: "Assumir responsabilidade no dashboard",
                          })
                        }
                      >
                        Assumir ordem
                      </button>
                    )}
                    {ownRun && run.procedure && (
                      <>
                        {step && ["quality", "release"].includes(step.kind) && (
                          <button
                            className="btn btn-secondary"
                            disabled={disabled}
                            onClick={() => setSelected("quality_check")}
                          >
                            Registrar medição
                          </button>
                        )}
                        {run.operational_status === "awaiting_review" ? (
                          <button
                            className="btn btn-primary"
                            disabled={disabled}
                            onClick={() => setSelected("complete")}
                          >
                            Finalizar lote
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary"
                            disabled={
                              disabled ||
                              run.operational_status === "paused" ||
                              !step
                            }
                            onClick={() =>
                              send("confirm_step", {
                                phase: run.phase,
                                step: run.step,
                              })
                            }
                          >
                            Confirmar instrução
                          </button>
                        )}
                        {run.operational_status === "paused" ? (
                          <button
                            className="btn btn-secondary"
                            disabled={disabled}
                            onClick={() => send("resume")}
                          >
                            Retomar
                          </button>
                        ) : (
                          <button
                            className="btn btn-secondary"
                            disabled={disabled}
                            onClick={() => setSelected("pause")}
                          >
                            Pausar
                          </button>
                        )}
                        <button
                          className="btn btn-secondary"
                          disabled={disabled}
                          onClick={() => setSelected("issue")}
                        >
                          Informar problema
                        </button>
                      </>
                    )}
                    <button
                      className="btn btn-secondary"
                      disabled={disabled}
                      onClick={() => setSelected("cancel")}
                    >
                      Cancelar ordem
                    </button>
                  </div>
                </>
              )}
            {selected && (
              <div className={styles.formPanel}>
                <div className={styles.formHeading}>
                  <h3>
                    {(
                      {
                        create: "Nova ordem",
                        configure: "Vincular revisões",
                        quality_check: "Medição de qualidade",
                        complete: "Finalizar lote",
                        pause: "Pausar em segurança",
                        issue: "Informar problema",
                        cancel: "Cancelar ordem",
                      } as Record<string, string>
                    )[selected] ?? "Registrar ação"}
                  </h3>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => setSelected(null)}
                    disabled={busy}
                  >
                    Fechar
                  </button>
                </div>
                {selected === "configure" && (
                  <OrderConfiguration
                    snapshot={snapshot}
                    busy={disabled}
                    onSubmit={(payload) => send("configure", payload)}
                  />
                )}
                {selected === "quality_check" && (
                  <QualityForm
                    run={run}
                    snapshot={snapshot}
                    disabled={disabled}
                    onSubmit={(payload) => send("quality_check", payload)}
                  />
                )}
                {selected === "complete" && (
                  <CompleteForm
                    snapshot={snapshot}
                    disabled={disabled}
                    onSubmit={(payload) => send("complete", payload)}
                  />
                )}
                {["pause", "issue", "cancel"].includes(selected) && (
                  <form
                    className="inventory-form mt-4"
                    action={(data) => {
                      const reason = String(data.get("reason") ?? "").trim();
                      if (selected === "pause")
                        send("pause", {
                          reason,
                          safe_point_confirmed:
                            data.get("safe_point_confirmed") === "on",
                        });
                      else if (selected === "issue") send("issue", { reason });
                      else
                        send("cancel", {
                          reason,
                          disposition: String(data.get("disposition")),
                          destination: String(data.get("destination")),
                        });
                    }}
                  >
                    <div className="field">
                      <label htmlFor="dashboard-reason">Motivo</label>
                      <textarea
                        id="dashboard-reason"
                        name="reason"
                        minLength={3}
                        maxLength={1000}
                        required
                      />
                    </div>
                    {selected === "pause" && (
                      <label className={styles.check}>
                        <input
                          type="checkbox"
                          name="safe_point_confirmed"
                          required
                        />{" "}
                        Confirmo que a operação física está em ponto seguro
                        conforme o procedimento.
                      </label>
                    )}
                    {selected === "cancel" && (
                      <>
                        <div className="field">
                          <label htmlFor="dashboard-disposition">
                            Tratamento dos insumos
                          </label>
                          <select
                            id="dashboard-disposition"
                            name="disposition"
                            required
                          >
                            <option value="">Selecione</option>
                            <option value="segregated">Segregados</option>
                            <option value="discarded">
                              Descartados conforme decisão autorizada
                            </option>
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="dashboard-destination">
                            Destino e responsável pela decisão
                          </label>
                          <input
                            id="dashboard-destination"
                            name="destination"
                            minLength={3}
                            maxLength={1000}
                            required
                          />
                        </div>
                      </>
                    )}
                    <button className="btn btn-primary" disabled={disabled}>
                      Confirmar registro
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
          <aside className={styles.side}>
            <h3>Rastreabilidade e conferência</h3>
            <dl>
              {run.inputs.map((input) => (
                <div key={input.lot_id}>
                  <dt>
                    {input.product_name} · {input.code}
                  </dt>
                  <dd>{quantity(Number(input.quantity), input.unit)}</dd>
                </div>
              ))}
            </dl>
            {run.profile && (
              <div className={styles.section}>
                <h4>
                  {run.profile.name} · rev. {run.profile.revision}
                </h4>
                {run.profile.parameters.map((item) => (
                  <p key={item.name}>
                    {item.name}: {quantity(Number(item.value), item.unit)} ·
                    limites {quantity(Number(item.min))}–
                    {quantity(Number(item.max), item.unit)}
                  </p>
                ))}
              </div>
            )}
            {run.qualityChecks.length > 0 && (
              <div className={styles.section}>
                <h4>Medições</h4>
                {run.qualityChecks.map((item) => (
                  <p key={item.id}>
                    {quantity(Number(item.net), item.unit)} ·{" "}
                    {item.passed ? "Conforme" : "Fora da regra"} ·{" "}
                    {dateTime(item.created_at)}
                  </p>
                ))}
              </div>
            )}
            {run.nonconformities.length > 0 && (
              <div className={styles.section}>
                <h4>Desvios e decisões</h4>
                {run.nonconformities.map((item) => (
                  <div key={item.id} className={styles.deviation}>
                    <p>
                      <strong>{item.status}</strong> · {item.reason}
                    </p>
                    {item.decision && <p>{item.decision}</p>}
                    {item.status !== "closed" && (
                      <form
                        className="inventory-form"
                        action={(data) =>
                          send("resolve_nonconformity", {
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
                        <div className="field">
                          <label htmlFor={`decision-${item.id}`}>
                            Decisão e destino
                          </label>
                          <input
                            id={`decision-${item.id}`}
                            name="decision"
                            minLength={3}
                            maxLength={1000}
                            required
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`reason-${item.id}`}>
                            Justificativa
                          </label>
                          <input
                            id={`reason-${item.id}`}
                            name="reason"
                            minLength={3}
                            maxLength={1000}
                            required
                          />
                        </div>
                        <button
                          className="btn btn-secondary"
                          disabled={disabled}
                        >
                          Registrar decisão
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className={styles.formPanel}>
          <OrderConfiguration
            snapshot={snapshot}
            create
            busy={disabled}
            onSubmit={(payload) => send("create", payload)}
          />
        </div>
      )}
    </section>
  );
}
