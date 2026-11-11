"use client";

import { useRef, useState } from "react";
import {
  loadPreparation,
  sendPreparationCommand,
  updatePreparationGuide,
} from "@/app/terminal/preparo/actions";
import type { PreparationSnapshot } from "@/lib/preparation/types";

export function PreparationAdministration({
  initial,
}: {
  initial: PreparationSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [productId, setProductId] = useState(initial.products[0]?.id ?? "");
  const [steps, setSteps] = useState([""]);
  const [editingGuideId, setEditingGuideId] = useState<string | null>(null);
  const [workMinutes, setWorkMinutes] = useState(
    String(initial.reminders.workMinutes),
  );
  const [restMinutes, setRestMinutes] = useState(
    String(initial.reminders.restMinutes),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const pendingIntent = useRef<{ key: string; id: string } | null>(null);
  const editingGuide = snapshot.guides.find(
    (guide) => guide.id === editingGuideId,
  );
  const canSaveGuide =
    !!productId &&
    steps.every((step) => step.trim().length >= 5) &&
    (!editingGuide ||
      JSON.stringify(steps.map((step) => step.trim())) !==
        JSON.stringify(editingGuide.steps));
  async function saveGuide() {
    if (!editingGuideId) {
      await execute("save_guide", {
        productId,
        steps: steps.map((step) => step.trim()),
      });
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await updatePreparationGuide(editingGuideId, steps);
      if (!result.ok) {
        setMessage(result.error ?? "Não foi possível salvar o rascunho.");
        return;
      }
      setSnapshot(await loadPreparation());
      setEditingGuideId(null);
      setSteps([""]);
      setMessage("Rascunho atualizado.");
    } catch {
      setMessage("Não foi possível atualizar. Verifique a conexão.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function execute(
    kind: "save_guide" | "approve_guide" | "set_reminders",
    payload: Record<string, unknown>,
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    const key = JSON.stringify({ kind, payload });
    if (pendingIntent.current?.key !== key)
      pendingIntent.current = { key, id: crypto.randomUUID() };
    setBusy(true);
    setMessage("");
    try {
      const result = await sendPreparationCommand({
        commandId: pendingIntent.current.id,
        batchId: null,
        kind,
        payload,
      });
      if (!result.ok) {
        setMessage(result.error ?? "Operação recusada.");
        return;
      }
      setSnapshot(await loadPreparation());
      pendingIntent.current = null;
      if (kind === "save_guide") setSteps([""]);
      setMessage("Registro salvo.");
    } catch {
      setMessage("Não foi possível atualizar. Verifique a conexão.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {message && (
        <p className="notice xl:col-span-2" role="status">
          {message}
        </p>
      )}
      <section className="panel panel-inset">
        <h2 className="text-2xl font-bold">Instruções por fruta</h2>
        <p className="muted mt-2">
          Cadastre apenas instruções revisadas pelo responsável técnico. A
          versão aprovada fica congelada em cada preparo iniciado.
        </p>
        <label className="field mt-5">
          Fruta
          <select
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              setEditingGuideId(null);
              setSteps([""]);
            }}
            disabled={busy}
          >
            {snapshot.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-5 grid gap-3">
          {steps.map((step, index) => (
            <label className="field" key={index}>
              Instrução {index + 1}
              <input
                value={step}
                maxLength={140}
                onChange={(event) =>
                  setSteps((current) =>
                    current.map((value, item) =>
                      item === index ? event.target.value : value,
                    ),
                  )
                }
                placeholder="Ação curta e concreta"
              />
            </label>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="btn btn-secondary"
            disabled={steps.length >= 6}
            onClick={() => setSteps((current) => [...current, ""])}
          >
            + Instrução
          </button>
          {steps.length > 1 && (
            <button
              className="btn btn-secondary"
              onClick={() => setSteps((current) => current.slice(0, -1))}
            >
              Remover última
            </button>
          )}
          {canSaveGuide && (
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void saveGuide()}
            >
              {editingGuideId ? "Salvar alterações" : "Salvar rascunho"}
            </button>
          )}
          {editingGuideId && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setEditingGuideId(null);
                setSteps([""]);
              }}
            >
              Cancelar edição
            </button>
          )}
        </div>
        <h3 className="mt-8 text-xl font-bold">Versões</h3>
        <div className="mt-3 grid gap-3">
          {snapshot.guides.map((guide) => (
            <article
              className="rounded-2xl border border-line p-4"
              key={guide.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <strong>
                  {guide.productName} · revisão {guide.revision} ·{" "}
                  {guide.status === "approved" ? "Aprovado" : "Rascunho"}
                </strong>
                {guide.status === "draft" && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => {
                        setProductId(guide.productId);
                        setEditingGuideId(guide.id);
                        setSteps([...guide.steps]);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Editar rascunho
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() =>
                        void execute("approve_guide", { guideId: guide.id })
                      }
                    >
                      Aprovar guia
                    </button>
                  </div>
                )}
              </div>
              <ol className="mt-3 list-decimal pl-5">
                {guide.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>
      <div className="grid content-start gap-5">
        <section className="panel panel-inset">
          <h2 className="text-2xl font-bold">Lembrete de descanso</h2>
          <p className="muted mt-2">
            O aviso não pausa ninguém automaticamente. Cada pessoa registra sua
            pausa com PIN.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="field">
              Trabalho (min)
              <input
                type="number"
                min={15}
                max={240}
                value={workMinutes}
                onChange={(event) => setWorkMinutes(event.target.value)}
              />
            </label>
            <label className="field">
              Descanso (min)
              <input
                type="number"
                min={5}
                max={90}
                value={restMinutes}
                onChange={(event) => setRestMinutes(event.target.value)}
              />
            </label>
          </div>
          {(Number(workMinutes) !== snapshot.reminders.workMinutes ||
            Number(restMinutes) !== snapshot.reminders.restMinutes) && (
            <button
              className="btn btn-primary mt-5"
              disabled={busy}
              onClick={() =>
                void execute("set_reminders", {
                  workMinutes: Number(workMinutes),
                  restMinutes: Number(restMinutes),
                })
              }
            >
              Salvar lembretes
            </button>
          )}
        </section>
        <section className="panel panel-inset">
          <h2 className="text-2xl font-bold">Preparo e rastreabilidade</h2>
          <p className="muted mt-2">
            Cada balde fica ligado ao lote de origem. Só um lote preparado pode
            seguir para a despolpa quando há guia aprovado.
          </p>
          <div className="mt-5 grid gap-3">
            {snapshot.batches.map((batch) => (
              <article
                className="rounded-2xl border border-line p-4"
                key={batch.id}
              >
                <strong>
                  {batch.code} · {batch.productName}
                </strong>
                <p className="muted mt-1">
                  {batch.status === "active"
                    ? "Em preparo"
                    : batch.status === "completed"
                      ? "Concluído"
                      : "Cancelado"}{" "}
                  · origem {batch.sourceCode} · {batch.inputQuantity}{" "}
                  {batch.inputUnit}
                </p>
                {batch.status === "completed" && (
                  <p className="mt-1">
                    {batch.bucketCount} balde(s) · {batch.locationName} ·{" "}
                    {batch.workers.length} participação(ões)
                  </p>
                )}
              </article>
            ))}
            {snapshot.batches.length === 0 && (
              <p className="muted">Nenhum preparo registrado.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
