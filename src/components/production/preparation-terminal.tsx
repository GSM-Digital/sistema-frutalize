"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  loadPreparation,
  sendPreparationCommand,
  verifyPreparationPin,
} from "@/app/terminal/preparo/actions";
import type {
  PreparationKind,
  PreparationSnapshot,
  PreparationWorker,
} from "@/lib/preparation/types";

function minutes(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 3600)).padStart(2, "0")}:${String(Math.floor((value % 3600) / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function unitLabel(unit: string, quantity?: number) {
  if (unit === "pct") return quantity === 1 ? "pacote" : "pacotes";
  if (unit === "un") return quantity === 1 ? "unidade" : "unidades";
  if (unit === "cx") return quantity === 1 ? "caixa" : "caixas";
  return unit;
}

function worked(
  started: string,
  pausedAt: string | null,
  pausedSeconds: number,
  now: number,
  endedAt?: string | null,
) {
  const end = endedAt
    ? Date.parse(endedAt)
    : pausedAt
      ? Date.parse(pausedAt)
      : now;
  return (end - Date.parse(started)) / 1000 - Number(pausedSeconds);
}

type PinAction = {
  kind: PreparationKind;
  batchId: string | null;
  payload: Record<string, unknown>;
};

export function PreparationTerminal({
  initial,
  preview = false,
}: {
  initial: PreparationSnapshot;
  preview?: boolean;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.batches.find((batch) => batch.status === "active")?.id ?? null,
  );
  const [lotId, setLotId] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState<"choose" | "quantity">("choose");
  const [setupPin, setSetupPin] = useState("");
  const [setupName, setSetupName] = useState("");
  const [showActive, setShowActive] = useState(false);
  const [previewGuideId, setPreviewGuideId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [pinAction, setPinAction] = useState<PinAction | null>(null);
  const [pin, setPin] = useState("");
  const [finishOpen, setFinishOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [allUnprocessed, setAllUnprocessed] = useState(false);
  const [processed, setProcessed] = useState("");
  const [bucketCount, setBucketCount] = useState("");
  const [destination, setDestination] = useState<"freezer" | "pulping">(
    "freezer",
  );
  const [locationId, setLocationId] = useState("");
  const [weights, setWeights] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [clock, setClock] = useState(Date.parse(initial.serverTime));
  const [clockOffset, setClockOffset] = useState(0);
  const inFlight = useRef(false);
  const pendingIntent = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setClockOffset(Date.parse(initial.serverTime) - Date.now());
      setClock(Date.now());
    });
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [initial.serverTime]);
  useEffect(() => {
    if (busy || preview) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await loadPreparation();
        setClockOffset(Date.parse(next.serverTime) - Date.now());
        setSnapshot(next);
      } catch {
        // Keep the current operation visible; the manual update remains available.
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [busy, preview]);
  const now = clock + clockOffset;
  const batch = snapshot.batches.find((entry) => entry.id === selectedId);
  const lot = snapshot.rawLots.find((entry) => entry.id === lotId);
  const guide = snapshot.guides.find(
    (entry) =>
      entry.productId === lot?.productId && entry.status === "approved",
  );
  const draftGuide = snapshot.guides.find(
    (entry) => entry.productId === lot?.productId && entry.status === "draft",
  );
  const previewGuide = snapshot.guides.find(
    (entry) => entry.id === previewGuideId,
  );
  const active = snapshot.batches.filter((entry) => entry.status === "active");
  const freezerLocations = snapshot.locations.filter((entry) =>
    entry.name.toLowerCase().startsWith("freezer "),
  );
  const pulpingLocations = snapshot.locations.filter(
    (entry) => entry.name.toLowerCase().trim() === "área de despolpa",
  );
  const locations =
    destination === "freezer" ? freezerLocations : pulpingLocations;

  async function refresh() {
    if (preview) return snapshot;
    const next = await loadPreparation();
    setClockOffset(Date.parse(next.serverTime) - Date.now());
    setSnapshot(next);
    return next;
  }

  async function run(
    kind: PreparationKind,
    batchId: string | null,
    payload: Record<string, unknown>,
  ) {
    if (preview) {
      setMessage("Prévia fictícia: ações desativadas.");
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    const key = JSON.stringify({ kind, batchId, payload });
    if (pendingIntent.current?.key !== key)
      pendingIntent.current = { key, id: crypto.randomUUID() };
    setBusy(true);
    setMessage("");
    try {
      const result = await sendPreparationCommand({
        commandId: pendingIntent.current.id,
        batchId,
        kind,
        payload,
      });
      if (!result.ok) {
        setMessage(result.error ?? "Operação recusada.");
        return;
      }
      const next = await refresh();
      pendingIntent.current = null;
      if (kind === "start")
        setSelectedId(
          result.id ??
            next.batches.find((entry) => entry.status === "active")?.id ??
            null,
        );
      if (kind === "finish" || kind === "cancel") setSelectedId(null);
      setPinAction(null);
      setPin("");
      setFinishOpen(false);
      setCancelOpen(false);
      setLotId(null);
      setSetupStep("choose");
      setSetupPin("");
      setSetupName("");
      setMessage(
        kind === "finish"
          ? "Preparo concluído. Os baldes foram registrados no estoque."
          : "Registro atualizado.",
      );
    } catch {
      setMessage("Conexão indisponível. Atualize antes de tentar novamente.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function askPin(
    kind: PreparationKind,
    batchId: string | null,
    payload: Record<string, unknown> = {},
  ) {
    setMessage("");
    setPin("");
    setPinAction({ kind, batchId, payload });
  }

  async function submitPin() {
    if (!pinAction || pin.length !== 4) return;
    if (pinAction.kind === "start" && setupStep === "choose") {
      if (preview) {
        setSetupName("Operador de demonstração");
        setSetupPin(pin);
        setPin("");
        setPinAction(null);
        setSetupStep("quantity");
        return;
      }
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        const result = await verifyPreparationPin(pin);
        if (!result.ok) {
          setMessage(result.error ?? "PIN inválido.");
          return;
        }
        setSetupName(result.name ?? "Operador identificado");
      } catch {
        setMessage("Não foi possível confirmar o PIN.");
        return;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
      setSetupPin(pin);
      setPin("");
      setPinAction(null);
      setSetupStep("quantity");
      return;
    }
    void run(pinAction.kind, pinAction.batchId, { ...pinAction.payload, pin });
  }

  function finish() {
    if (!batch) return;
    const actual = Number(processed.replace(",", "."));
    const count = Number(bucketCount);
    const parsedWeights = weights.trim()
      ? weights
          .split(/[;\n]/)
          .map((value) => Number(value.trim().replace(",", ".")))
      : null;
    if (
      !Number.isFinite(actual) ||
      actual <= 0 ||
      actual > batch.inputQuantity ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 40 ||
      !locationId ||
      (parsedWeights !== null &&
        (parsedWeights.length !== count ||
          parsedWeights.some((value) => !Number.isFinite(value) || value <= 0)))
    ) {
      setMessage("Confira a quantidade preparada, os baldes e o local físico.");
      return;
    }
    askPin("finish", batch.id, {
      processedQuantity: actual,
      bucketCount: count,
      destination,
      locationId,
      weightsKg: parsedWeights,
    });
  }

  function workerCard(worker: PreparationWorker) {
    const activeWorker = !worker.endedAt;
    const workSeconds = worked(
      worker.startedAt,
      worker.pausedAt,
      worker.pausedSeconds,
      now,
      worker.endedAt,
    );
    const reminder =
      activeWorker &&
      !worker.pausedAt &&
      workSeconds >= snapshot.reminders.workMinutes * 60;
    const restSeconds = worker.pausedAt
      ? Math.max(0, (now - Date.parse(worker.pausedAt)) / 1000)
      : 0;
    return (
      <div
        className={`prep-worker${reminder ? " prep-reminder" : ""}`}
        key={worker.id}
      >
        <div>
          <strong>{worker.name}</strong>
          <span>
            {worker.endedAt
              ? "Saiu"
              : worker.pausedAt
                ? `Em descanso · ${minutes(restSeconds)} / ${snapshot.reminders.restMinutes} min`
                : reminder
                  ? "Hora de descansar"
                  : "Trabalhando"}
          </span>
        </div>
        <b>{minutes(workSeconds)}</b>
      </div>
    );
  }

  return (
    <main className="prep-terminal" data-terminal-page>
      <header className="prep-header">
        <div>
          <span className="prep-kicker">FRUTALIZE · TERMINAL TOUCH</span>
          <h1>Preparo de frutas</h1>
        </div>
        <div className="prep-header-actions">
          <button
            className="prep-button prep-light"
            onClick={() => void refresh()}
            disabled={busy}
          >
            Atualizar
          </button>
          <Link className="prep-button prep-light" href="/terminal">
            Despolpa →
          </Link>
        </div>
      </header>
      {message && (
        <p role="status" className="prep-message">
          {message}
        </p>
      )}
      {!batch ? (
        <section className="prep-overview prep-overview-single">
          {setupStep === "choose" ? (
            <div className="prep-pane">
              <h2>O que vamos preparar?</h2>
              <p>Escolha um lote de fruta disponível no estoque.</p>
              <div className="prep-list">
                {snapshot.rawLots.length ? (
                  snapshot.rawLots.map((entry) => {
                    const ready = snapshot.guides.some(
                      (item) =>
                        item.productId === entry.productId &&
                        item.status === "approved",
                    );
                    return (
                      <button
                        key={entry.id}
                        className={`prep-lot${lotId === entry.id ? " prep-selected" : ""}`}
                        onClick={() => {
                          setLotId(entry.id);
                          setQuantity("");
                          setSetupPin("");
                          setSetupName("");
                        }}
                      >
                        <strong>{entry.productName}</strong>
                        <span>
                          {entry.quantity}{" "}
                          {unitLabel(entry.unit, entry.quantity)} ·{" "}
                          {entry.locationName}
                        </span>
                        <small>{entry.code}</small>
                        {!ready && <em>Guia ainda não aprovado</em>}
                      </button>
                    );
                  })
                ) : (
                  <p>Nenhuma fruta disponível no estoque.</p>
                )}
              </div>
              <div className="prep-selection-actions">
                <button
                  className="prep-button prep-primary"
                  disabled={!lot || !guide || busy}
                  onClick={() => {
                    if (lot) askPin("start", null, { lotId: lot.id });
                  }}
                >
                  Começar preparo
                </button>
                {!guide && draftGuide && (
                  <button
                    className="prep-button prep-light"
                    onClick={() => setPreviewGuideId(draftGuide.id)}
                  >
                    Visualizar guia de teste
                  </button>
                )}
                {active.length > 0 && (
                  <button
                    className="prep-button prep-light"
                    onClick={() => setShowActive((current) => !current)}
                  >
                    {active.length} preparo(s) em andamento
                  </button>
                )}
              </div>
              {showActive && active.length > 0 && (
                <div className="prep-resume-list">
                  {active.map((item) => (
                    <button
                      key={item.id}
                      className="prep-lot"
                      onClick={() => setSelectedId(item.id)}
                    >
                      <strong>{item.productName}</strong>
                      <span>
                        {item.inputQuantity}{" "}
                        {unitLabel(item.inputUnit, item.inputQuantity)} · Em
                        andamento
                      </span>
                      <small>{item.code}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="prep-pane">
              <button
                className="prep-back"
                onClick={() => {
                  setSetupPin("");
                  setSetupName("");
                  setSetupStep("choose");
                }}
              >
                ← Voltar aos lotes
              </button>
              <h2>{lot ? lot.productName : "Escolha um lote"}</h2>
              {lot ? (
                <div className="prep-start">
                  <p>
                    {lot.quantity} {unitLabel(lot.unit, lot.quantity)}{" "}
                    disponíveis · {lot.locationName}
                  </p>
                  <p>
                    Responsável: <strong>{setupName}</strong>
                  </p>
                  <p>
                    {guide
                      ? `${guide.steps.length} instruções aprovadas · revisão ${guide.revision}`
                      : "Esta fruta ainda não tem instruções aprovadas. Peça ao administrador para cadastrar o guia."}
                  </p>
                  <label>
                    Quantidade a preparar ({unitLabel(lot.unit)})
                    <input
                      inputMode="decimal"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      placeholder={`Até ${lot.quantity} ${unitLabel(lot.unit, lot.quantity)}`}
                    />
                  </label>
                  <button
                    className="prep-button prep-primary"
                    disabled={!guide || !quantity || !setupPin || busy}
                    onClick={() => {
                      const amount = Number(quantity.replace(",", "."));
                      if (
                        !Number.isFinite(amount) ||
                        amount <= 0 ||
                        amount > lot.quantity
                      ) {
                        setMessage("Informe uma quantidade dentro do saldo.");
                        return;
                      }
                      void run("start", null, {
                        lotId: lot.id,
                        quantity: amount,
                        pin: setupPin,
                      });
                    }}
                  >
                    Iniciar cronômetro e preparo
                  </button>
                  <p className="prep-help">
                    Identificação concluída. Após informar a quantidade, a
                    contagem 3 · 2 · 1 inicia o cronômetro.
                  </p>
                </div>
              ) : (
                <div className="prep-list">
                  {active.length ? (
                    active.map((item) => (
                      <button
                        key={item.id}
                        className="prep-lot"
                        onClick={() => setSelectedId(item.id)}
                      >
                        <strong>{item.productName}</strong>
                        <span>
                          {item.inputQuantity} {item.inputUnit} ·{" "}
                          {
                            item.workers.filter((worker) => !worker.endedAt)
                              .length
                          }{" "}
                          pessoa(s)
                        </span>
                        <small>{item.code}</small>
                      </button>
                    ))
                  ) : (
                    <p>Nenhum preparo em andamento.</p>
                  )}
                </div>
              )}
              {lot && (
                <button
                  className="prep-button prep-light"
                  onClick={() => {
                    setLotId(null);
                    setSetupPin("");
                    setSetupName("");
                    setSetupStep("choose");
                  }}
                >
                  Escolher outro lote
                </button>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="prep-active">
          <div className="prep-pane prep-main">
            <div className="prep-batch-heading">
              <button className="prep-back" onClick={() => setSelectedId(null)}>
                ← Fila
              </button>
              <span>{batch.code}</span>
            </div>
            <h2>{batch.productName}</h2>
            <div className="prep-clock-label">
              {now < Date.parse(batch.startedAt)
                ? "COMEÇANDO EM"
                : batch.pausedAt
                  ? "EM PAUSA"
                  : "TEMPO DE PREPARO"}
            </div>
            <div className="prep-clock">
              {now < Date.parse(batch.startedAt)
                ? Math.ceil((Date.parse(batch.startedAt) - now) / 1000)
                : minutes(
                    worked(
                      batch.startedAt,
                      batch.pausedAt,
                      batch.pausedSeconds,
                      now,
                    ),
                  )}
            </div>
            <p className="prep-source">
              {batch.inputQuantity} {batch.inputUnit} de {batch.sourceCode}
            </p>
            <div className="prep-steps">
              <h3>Como preparar</h3>
              <ol>
                {batch.guide.steps.map((step, index) => (
                  <li key={index}>
                    <b>{index + 1}</b>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="prep-pane prep-team">
            <h2>Equipe</h2>
            <p>Tempo de trabalho por pessoa. Pausas não entram na contagem.</p>
            <div className="prep-workers">{batch.workers.map(workerCard)}</div>
            <div className="prep-controls">
              <button
                className="prep-button prep-light"
                onClick={() => askPin("join", batch.id)}
                disabled={busy}
              >
                + Entrar na equipe
              </button>
              <button
                className="prep-button prep-warn"
                onClick={() => askPin("break", batch.id)}
                disabled={busy}
              >
                Fazer pausa
              </button>
              <button
                className="prep-button prep-light"
                onClick={() => askPin("resume", batch.id)}
                disabled={busy}
              >
                Voltar da pausa
              </button>
              <button
                className="prep-button prep-light"
                onClick={() => askPin("leave", batch.id)}
                disabled={busy}
              >
                Sair da equipe
              </button>
            </div>
            <button
              className="prep-button prep-primary prep-finish"
              onClick={() => {
                setProcessed(String(batch.inputQuantity));
                setBucketCount("");
                setLocationId("");
                setWeights("");
                setFinishOpen(true);
              }}
              disabled={busy || now < Date.parse(batch.startedAt)}
            >
              Concluir preparo
            </button>
            {["admin", "manager"].includes(snapshot.actor.role) && (
              <button
                className="prep-back"
                onClick={() => {
                  setCancelReason("");
                  setAllUnprocessed(false);
                  setCancelOpen(true);
                }}
              >
                Cancelar preparo sem material processado
              </button>
            )}
          </div>
        </section>
      )}
      {finishOpen && batch && (
        <div
          className="prep-modal-backdrop"
          onClick={() => setFinishOpen(false)}
        >
          <section
            className="prep-modal prep-finish-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Concluir preparo"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Concluir preparo</h2>
            <p>
              Registre o que foi feito. A parte não preparada volta ao saldo
              original.
            </p>
            <div className="prep-form-grid">
              <label>
                Quantidade preparada ({batch.inputUnit})
                <input
                  inputMode="decimal"
                  value={processed}
                  onChange={(event) => setProcessed(event.target.value)}
                />
              </label>
              <label>
                Quantos baldes?
                <input
                  inputMode="numeric"
                  value={bucketCount}
                  onChange={(event) => setBucketCount(event.target.value)}
                />
              </label>
            </div>
            <div className="prep-choice" role="group" aria-label="Destino">
              <button
                className={destination === "freezer" ? "prep-selected" : ""}
                onClick={() => {
                  setDestination("freezer");
                  setLocationId("");
                }}
              >
                Congelador
              </button>
              <button
                className={destination === "pulping" ? "prep-selected" : ""}
                onClick={() => {
                  setDestination("pulping");
                  setLocationId("");
                }}
              >
                Aguardar despolpa
              </button>
            </div>
            <label>
              Local físico
              <select
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
              >
                <option value="">Selecione</option>
                {locations.map((entry) => (
                  <option value={entry.id} key={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Peso de cada balde em kg (opcional; se medido, um por linha)
              <textarea
                value={weights}
                onChange={(event) => setWeights(event.target.value)}
                rows={2}
                placeholder="Ex.: 2,5&#10;2,3"
              />
            </label>
            <div className="prep-modal-actions">
              <button
                className="prep-button prep-light"
                onClick={() => setFinishOpen(false)}
              >
                Voltar
              </button>
              <button className="prep-button prep-primary" onClick={finish}>
                Confirmar com PIN
              </button>
            </div>
          </section>
        </div>
      )}
      {cancelOpen && batch && (
        <div
          className="prep-modal-backdrop"
          onClick={() => setCancelOpen(false)}
        >
          <section
            className="prep-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Cancelar preparo"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Cancelar preparo</h2>
            <p>
              Use apenas se nenhuma fruta foi preparada. Todo o saldo reservado
              voltará ao lote original.
            </p>
            <label>
              Motivo do cancelamento
              <input
                value={cancelReason}
                maxLength={220}
                onChange={(event) => setCancelReason(event.target.value)}
              />
            </label>
            <label className="prep-check">
              <input
                type="checkbox"
                checked={allUnprocessed}
                onChange={(event) => setAllUnprocessed(event.target.checked)}
              />
              Confirmo que nenhuma fruta foi preparada.
            </label>
            <div className="prep-modal-actions">
              <button
                className="prep-button prep-light"
                onClick={() => setCancelOpen(false)}
              >
                Voltar
              </button>
              <button
                className="prep-button prep-warn"
                disabled={!allUnprocessed || cancelReason.trim().length < 8}
                onClick={() =>
                  askPin("cancel", batch.id, {
                    reason: cancelReason.trim(),
                    allUnprocessed: true,
                  })
                }
              >
                Confirmar com PIN de gestor
              </button>
            </div>
          </section>
        </div>
      )}
      {pinAction && (
        <div className="prep-modal-backdrop" onClick={() => setPinAction(null)}>
          <section
            className="prep-modal prep-pin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Digite seu PIN"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Digite seu PIN</h2>
            <p>Cada pessoa usa seu PIN de 4 dígitos.</p>
            {message && (
              <p className="prep-message" role="alert">
                {message}
              </p>
            )}
            <div className="prep-pin-display" aria-live="polite">
              {pin.padEnd(4, "–")}
            </div>
            <div className="prep-keypad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "⌫"].map((digit, index) =>
                digit === null ? (
                  <span key={index} />
                ) : (
                  <button
                    key={index}
                    onClick={() =>
                      setPin((current) =>
                        digit === "⌫"
                          ? current.slice(0, -1)
                          : (current + digit).slice(0, 4),
                      )
                    }
                  >
                    {digit}
                  </button>
                ),
              )}
            </div>
            <div className="prep-modal-actions">
              <button
                className="prep-button prep-light"
                onClick={() => setPinAction(null)}
              >
                Cancelar
              </button>
              <button
                className="prep-button prep-primary"
                disabled={pin.length !== 4 || busy}
                onClick={() => void submitPin()}
              >
                OK
              </button>
            </div>
          </section>
        </div>
      )}
      {previewGuide && (
        <div
          className="prep-modal-backdrop"
          onClick={() => setPreviewGuideId(null)}
        >
          <section
            className="prep-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Prévia do guia de preparo"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Prévia · {previewGuide.productName}</h2>
            <p>
              Rascunho de demonstração. O preparo real continua bloqueado até a
              aprovação do guia.
            </p>
            <div className="prep-steps">
              <h3>Como preparar</h3>
              <ol>
                {previewGuide.steps.map((step, index) => (
                  <li key={index}>
                    <b>{index + 1}</b>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <button
              className="prep-button prep-light"
              onClick={() => setPreviewGuideId(null)}
            >
              Fechar prévia
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
