"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  claimProductionOperator,
  saveProductionProgress,
  setOwnProductionPin,
} from "@/app/dashboard/inventory-actions";
import { CompleteProductionForm } from "@/components/inventory/forms";
import { dateTime, quantity } from "@/lib/inventory/format";
import type {
  InventoryProductionInput,
  InventoryProductionRun,
  InventoryVariant,
  Json,
  Location,
} from "@/lib/inventory/types";

type TerminalRun = InventoryProductionRun & {
  inputs: InventoryProductionInput[];
};

type WorkflowData = {
  responsibleOperatorId?: string;
  responsibleOperatorName?: string;
  responsibilityStartedAt?: string;
  packageSizeG?: 100 | 500;
  testPackageConfirmedAt?: string;
  productionStartedAt?: string;
  paused?: boolean;
  pausedAt?: string;
  accumulatedPausedSeconds?: number;
  productionEndedAt?: string;
  issues?: { note: string; recordedAt: string }[];
};

type Progress = {
  phase: number;
  step: number;
  data: WorkflowData;
  updatedAt: string;
};

type GuideStep = {
  title: string;
  instruction: string;
  checklist?: string[];
  kind?: "package" | "line" | "confirm-weight";
  action?: string;
};

type PinDialog =
  { kind: "identify"; runId: string } | { kind: "setup"; firstPin?: string };

type GuidePhase = {
  title: string;
  shortTitle: string;
  steps: GuideStep[];
};

function workflowData(value: Json): WorkflowData {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return value as WorkflowData;
}

function primaryInput(run: TerminalRun) {
  return run.inputs[0];
}

function normalizedWords(value: string) {
  const ignored = new Set(["fruta", "polpa", "polpas", "de", "da", "do"]);
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !ignored.has(word));
}

function outputVariantId(
  run: TerminalRun,
  variants: InventoryVariant[],
  packageSizeG?: number,
) {
  if (!packageSizeG) return "";
  const expectedWeight = packageSizeG / 1000;
  const byWeight = variants.filter(
    (variant) =>
      variant.unit_weight_kg !== null &&
      Math.abs(variant.unit_weight_kg - expectedWeight) < 0.000001,
  );
  const inputWords = normalizedWords(primaryInput(run)?.product_name ?? "");
  const byProduct = byWeight.find((variant) => {
    const outputWords = normalizedWords(variant.product_name);
    return inputWords.some((word) => outputWords.includes(word));
  });
  return byProduct?.id ?? (byWeight.length === 1 ? byWeight[0].id : "");
}

function preparationSteps(productName: string): GuideStep[] {
  const normalized = productName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized.includes("maracuja"))
    return [
      {
        title: "Corte os maracujás",
        instruction:
          "Corte cada fruta ao meio sobre a superfície limpa, evitando derramar a polpa.",
      },
      {
        title: "Retire a polpa",
        instruction:
          "Retire a polpa com sementes. Não raspe nem misture a parte branca da casca.",
      },
      {
        title: "Passe na despolpadeira",
        instruction:
          "Processe o conteúdo usando a peneira definida para o maracujá.",
      },
      {
        title: "Confira a polpa",
        instruction:
          "Verifique se a polpa está uniforme e sem casca ou sementes quebradas.",
      },
    ];

  if (normalized.includes("abacaxi"))
    return [
      {
        title: "Prepare os abacaxis",
        instruction:
          "Retire coroa, base, casca e olhos conforme o procedimento aprovado.",
      },
      {
        title: "Corte em pedaços",
        instruction: "Faça pedaços compatíveis com a entrada da despolpadeira.",
      },
      {
        title: "Passe na despolpadeira",
        instruction: "Processe a fruta com a configuração aprovada.",
      },
      {
        title: "Confira a polpa",
        instruction:
          "Verifique a uniformidade e se não restaram partes inadequadas da fruta.",
      },
    ];

  if (normalized.includes("morango"))
    return [
      {
        title: "Retire folhas e cabinhos",
        instruction:
          "Separe completamente as partes que não serão processadas.",
      },
      {
        title: "Prepare os morangos",
        instruction:
          "Mantenha os pequenos inteiros e corte apenas os que não couberem na máquina.",
      },
      {
        title: "Passe na despolpadeira",
        instruction: "Processe a fruta com a configuração aprovada.",
      },
      {
        title: "Confira a polpa",
        instruction:
          "Verifique a uniformidade antes de encaminhar para o envase.",
      },
    ];

  return [
    {
      title: `Prepare ${productName || "a fruta"}`,
      instruction: "Siga o preparo específico aprovado para esta fruta.",
    },
    {
      title: "Processe a fruta",
      instruction:
        "Use o equipamento e a configuração definidos no procedimento da produção.",
    },
    {
      title: "Confira a polpa",
      instruction:
        "Verifique se o resultado está uniforme e sem materiais inadequados.",
    },
  ];
}

function phasesFor(run: TerminalRun): GuidePhase[] {
  const product = primaryInput(run)?.product_name ?? "a fruta";
  return [
    {
      title: "Conferir a ordem",
      shortTitle: "Ordem",
      steps: [
        {
          title: "Confira o que entrou na produção",
          instruction:
            "Compare os dados desta tela com a fruta e a quantidade recebidas na área.",
          action: "Dados conferidos",
        },
        {
          title: "Confirme a higienização",
          instruction:
            "A fruta deve chegar selecionada, higienizada, escorrida e liberada para o processamento.",
          action: "Fruta liberada",
        },
      ],
    },
    {
      title: "Preparar os equipamentos",
      shortTitle: "Equipamentos",
      steps: [
        {
          title: "Confira a área e os utensílios",
          instruction:
            "Verifique limpeza, organização e disponibilidade dos utensílios desta produção.",
        },
        {
          title: "Confira a despolpadeira",
          instruction:
            "Confirme que a máquina está limpa, montada, protegida e com a peneira aprovada para esta fruta.",
        },
        {
          title: "Confira a linha de envase",
          instruction:
            "Deixe envasadora, seladora, datador e balança limpos e disponíveis. A regulagem final será feita com a polpa pronta.",
          action: "Equipamentos prontos",
        },
      ],
    },
    {
      title: `Preparar e processar ${product}`,
      shortTitle: "Processamento",
      steps: preparationSteps(product),
    },
    {
      title: "Preparar e liberar a linha",
      shortTitle: "Liberar linha",
      steps: [
        {
          title: "Escolha o tamanho da embalagem",
          instruction:
            "Este peso será usado em toda a produção. As opções ainda são provisórias e precisam ser confirmadas.",
          kind: "package",
          action: "Gramatura confirmada",
        },
        {
          title: "Configure envase, selagem e datador",
          instruction:
            "Aplique as regulagens aprovadas e configure o datador com o lote exibido na tela.",
          kind: "line",
          action: "Linha configurada",
        },
        {
          title: "Confirme a embalagem de teste",
          instruction:
            "Produza uma unidade e confirme que ela corresponde à gramatura escolhida antes de liberar a linha.",
          kind: "confirm-weight",
          action: "Liberar linha e iniciar produção",
        },
      ],
    },
    {
      title: "Produção em andamento",
      shortTitle: "Produzir",
      steps: [],
    },
    {
      title: "Finalizar e armazenar",
      shortTitle: "Finalizar",
      steps: [],
    },
  ];
}

function currentTimeLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function elapsedLabel(
  startedAt: string,
  now: Date,
  pausedAt?: string,
  accumulatedPausedSeconds = 0,
) {
  const end = pausedAt ? new Date(pausedAt) : now;
  const milliseconds = Math.max(
    0,
    end.getTime() -
      new Date(startedAt).getTime() -
      accumulatedPausedSeconds * 1000,
  );
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function ProductionTerminal({
  runs,
  variants,
  locations,
  initialRunId,
  now,
  completionRequestId,
}: {
  runs: TerminalRun[];
  variants: InventoryVariant[];
  locations: Location[];
  initialRunId?: string;
  now: string;
  completionRequestId: string;
}) {
  const router = useRouter();
  const activeRuns = useMemo(
    () => runs.filter((run) => run.status === "in_progress"),
    [runs],
  );
  const initialPendingRunId = activeRuns.some((run) => run.id === initialRunId)
    ? initialRunId
    : undefined;
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const [progress, setProgress] = useState<Record<string, Progress>>(() =>
    Object.fromEntries(
      activeRuns.map((run) => [
        run.id,
        {
          phase: run.workflow_phase,
          step: run.workflow_step,
          data: workflowData(run.workflow_data),
          updatedAt: run.workflow_updated_at,
        },
      ]),
    ),
  );
  const [clock, setClock] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [issue, setIssue] = useState("");
  const [pinDialog, setPinDialog] = useState<PinDialog | null>(() =>
    initialPendingRunId
      ? { kind: "identify", runId: initialPendingRunId }
      : null,
  );
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

  useEffect(() => {
    const initial = window.setTimeout(() => setClock(new Date()), 0);
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (selectedRunId) return;
    const refresh = window.setInterval(() => router.refresh(), 30000);
    return () => window.clearInterval(refresh);
  }, [router, selectedRunId]);

  const run = activeRuns.find((item) => item.id === selectedRunId);
  const runProgress = run
    ? (progress[run.id] ?? {
        phase: run.workflow_phase,
        step: run.workflow_step,
        data: workflowData(run.workflow_data),
        updatedAt: run.workflow_updated_at,
      })
    : undefined;
  const phases = run ? phasesFor(run) : [];
  const phase = runProgress ? phases[runProgress.phase - 1] : undefined;
  const step = phase?.steps[runProgress ? runProgress.step - 1 : 0];

  async function persist(
    targetRun: TerminalRun,
    next: Omit<Progress, "updatedAt">,
  ) {
    setSaving(true);
    setMessage("");
    const result = await saveProductionProgress({
      productionId: targetRun.id,
      phase: next.phase,
      step: next.step,
      data: next.data as Json,
    });
    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return false;
    }
    setProgress((current) => ({
      ...current,
      [targetRun.id]: {
        ...next,
        updatedAt: new Date().toISOString(),
      },
    }));
    return true;
  }

  function openIdentification(runId: string) {
    setPin("");
    setPinError("");
    setPinDialog({ kind: "identify", runId });
  }

  function openPinSetup() {
    setPin("");
    setPinError("");
    setPinDialog({ kind: "setup" });
  }

  function enterPinDigit(digit: string) {
    setPinError("");
    setPin((current) => (current.length < 4 ? current + digit : current));
  }

  function closePinDialog() {
    if (pinBusy) return;
    setPinDialog(null);
    setPin("");
    setPinError("");
    if (!selectedRunId)
      router.replace("/dashboard/producao", { scroll: false });
  }

  async function confirmPin() {
    if (!pinDialog || pin.length !== 4) {
      setPinError("Digite os quatro números do PIN.");
      return;
    }
    setPinBusy(true);
    setPinError("");

    if (pinDialog.kind === "setup") {
      if (!pinDialog.firstPin) {
        setPinDialog({ kind: "setup", firstPin: pin });
        setPin("");
        setPinBusy(false);
        return;
      }
      if (pinDialog.firstPin !== pin) {
        setPinDialog({ kind: "setup" });
        setPin("");
        setPinError("Os PINs não coincidem. Digite novamente.");
        setPinBusy(false);
        return;
      }
      const result = await setOwnProductionPin({ pin });
      setPinBusy(false);
      if (result.error) {
        setPinError(result.error);
        setPin("");
        return;
      }
      setPinDialog(null);
      setPin("");
      setMessage("Seu PIN operacional foi configurado.");
      return;
    }

    const targetRun = activeRuns.find((item) => item.id === pinDialog.runId);
    if (!targetRun) {
      setPinBusy(false);
      setPinError("Esta produção não está mais disponível.");
      return;
    }
    const result = await claimProductionOperator({
      productionId: targetRun.id,
      pin,
    });
    setPinBusy(false);
    if (result.error || !result.operator) {
      setPinError(result.error ?? "PIN não reconhecido.");
      setPin("");
      return;
    }

    const current = progress[targetRun.id] ?? {
      phase: targetRun.workflow_phase,
      step: targetRun.workflow_step,
      data: workflowData(targetRun.workflow_data),
      updatedAt: targetRun.workflow_updated_at,
    };
    setProgress((all) => ({
      ...all,
      [targetRun.id]: {
        ...current,
        data: {
          ...current.data,
          responsibleOperatorId: result.operator?.id,
          responsibleOperatorName: result.operator?.name,
          responsibilityStartedAt: result.operator?.responsibilityStartedAt,
        },
        updatedAt: new Date().toISOString(),
      },
    }));
    setSelectedRunId(targetRun.id);
    setPinDialog(null);
    setPin("");
    setMessage("");
    router.replace(`/dashboard/producao?ordem=${targetRun.id}`, {
      scroll: false,
    });
  }

  async function advance() {
    if (!run || !runProgress || !phase || !step) return;
    const data = { ...runProgress.data };
    if (step.kind === "package") {
      if (!data.packageSizeG) {
        setMessage("Escolha a gramatura da embalagem.");
        return;
      }
    }
    if (step.kind === "confirm-weight")
      data.testPackageConfirmedAt = new Date().toISOString();
    const atLastStep = runProgress.step >= phase.steps.length;
    const next = atLastStep
      ? {
          phase: runProgress.phase + 1,
          step: 1,
          data:
            runProgress.phase === 4
              ? {
                  ...data,
                  productionStartedAt:
                    data.productionStartedAt ?? new Date().toISOString(),
                }
              : data,
        }
      : { phase: runProgress.phase, step: runProgress.step + 1, data };
    await persist(run, next);
  }

  async function goBack() {
    if (!run || !runProgress || !phase) return;
    if (runProgress.step > 1) {
      await persist(run, {
        phase: runProgress.phase,
        step: runProgress.step - 1,
        data: runProgress.data,
      });
      return;
    }
    if (runProgress.phase <= 1) return;
    const previousPhase = phases[runProgress.phase - 2];
    await persist(run, {
      phase: runProgress.phase - 1,
      step: Math.max(1, previousPhase.steps.length),
      data: runProgress.data,
    });
  }

  async function togglePause() {
    if (!run || !runProgress) return;
    const nowIso = new Date().toISOString();
    const pausedSeconds = runProgress.data.pausedAt
      ? Math.max(
          0,
          Math.floor(
            (new Date(nowIso).getTime() -
              new Date(runProgress.data.pausedAt).getTime()) /
              1000,
          ),
        )
      : 0;
    await persist(run, {
      phase: 5,
      step: 1,
      data: runProgress.data.paused
        ? {
            ...runProgress.data,
            paused: false,
            pausedAt: undefined,
            accumulatedPausedSeconds:
              (runProgress.data.accumulatedPausedSeconds ?? 0) + pausedSeconds,
          }
        : {
            ...runProgress.data,
            paused: true,
            pausedAt: nowIso,
          },
    });
  }

  async function saveIssue() {
    if (!run || !runProgress || issue.trim().length < 3) {
      setMessage("Descreva o problema antes de registrar.");
      return;
    }
    const issues = [
      ...(runProgress.data.issues ?? []),
      { note: issue.trim(), recordedAt: new Date().toISOString() },
    ];
    if (
      await persist(run, {
        phase: runProgress.phase,
        step: runProgress.step,
        data: { ...runProgress.data, paused: true, issues },
      })
    ) {
      setIssue("");
      setIssueOpen(false);
      setMessage("Problema registrado. A produção foi pausada.");
    }
  }

  function renderPinDialog() {
    if (!pinDialog) return null;
    const isSetup = pinDialog.kind === "setup";
    const confirming = isSetup && Boolean(pinDialog.firstPin);
    const targetRun =
      pinDialog.kind === "identify"
        ? activeRuns.find((item) => item.id === pinDialog.runId)
        : undefined;
    return (
      <div className="terminal-pin-backdrop" role="presentation">
        <section
          className="terminal-pin-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="terminal-pin-title"
        >
          <header>
            <div>
              <span>{isSetup ? "PIN operacional" : targetRun?.code}</span>
              <h2 id="terminal-pin-title">
                {isSetup
                  ? confirming
                    ? "Confirme seu novo PIN"
                    : "Defina seu PIN de 4 dígitos"
                  : "Digite seu PIN para assumir a produção"}
              </h2>
              {!isSetup && (
                <p>
                  Você ficará registrado como responsável por toda esta ordem.
                </p>
              )}
            </div>
            <button
              type="button"
              className="terminal-pin-close"
              onClick={closePinDialog}
              disabled={pinBusy}
              aria-label="Fechar"
            >
              ×
            </button>
          </header>

          <div className="terminal-pin-display" aria-live="polite">
            {[0, 1, 2, 3].map((index) => (
              <span key={index}>{pin[index] ?? ""}</span>
            ))}
          </div>

          {pinError && (
            <p className="terminal-pin-error" role="alert">
              {pinError}
            </p>
          )}

          <div className="terminal-keypad" aria-label="Teclado numérico">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button
                type="button"
                key={digit}
                onClick={() => enterPinDigit(digit)}
                disabled={pinBusy}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              className="terminal-keypad-text"
              onClick={() => setPin("")}
              disabled={pinBusy || !pin}
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => enterPinDigit("0")}
              disabled={pinBusy}
            >
              0
            </button>
            <button
              type="button"
              className="terminal-keypad-text"
              onClick={() => setPin((current) => current.slice(0, -1))}
              disabled={pinBusy || !pin}
              aria-label="Apagar último número"
            >
              Apagar
            </button>
          </div>

          <button
            type="button"
            className="terminal-pin-confirm"
            onClick={confirmPin}
            disabled={pinBusy || pin.length !== 4}
          >
            {pinBusy
              ? "Verificando…"
              : isSetup
                ? confirming
                  ? "Salvar meu PIN"
                  : "Continuar"
                : "OK — Abrir produção"}
          </button>
        </section>
      </div>
    );
  }

  if (!run || !runProgress) {
    return (
      <div className="terminal-shell">
        <header className="terminal-topbar">
          <div className="terminal-brand" aria-label="Frutalize Produção">
            <span className="terminal-brand-mark">F</span>
            <div>
              <strong>Produção Frutalize</strong>
              <span>Terminal operacional</span>
            </div>
          </div>
          <div className="terminal-clock" aria-live="off">
            <strong>
              {clock ? currentTimeLabel(clock) : "Carregando horário…"}
            </strong>
            <div>
              <button type="button" onClick={openPinSetup}>
                Configurar meu PIN
              </button>
              <button type="button" onClick={() => router.refresh()}>
                Atualizar fila
              </button>
            </div>
          </div>
        </header>
        <main className="terminal-queue">
          <div className="terminal-queue-heading">
            <div>
              <span>Fila de trabalho</span>
              <h1>Produções para fazer</h1>
              <p>Toque em uma ordem para iniciar ou continuar.</p>
            </div>
            <div
              className="terminal-count"
              aria-label={`${activeRuns.length} ordens`}
            >
              <strong>{activeRuns.length}</strong>
              <span>{activeRuns.length === 1 ? "ordem" : "ordens"}</span>
            </div>
          </div>
          {message && (
            <p
              className="terminal-message terminal-queue-message"
              role="status"
            >
              {message}
            </p>
          )}
          {activeRuns.length ? (
            <div className="terminal-order-grid">
              {activeRuns.map((item) => {
                const itemProgress = progress[item.id] ?? {
                  phase: item.workflow_phase,
                  step: item.workflow_step,
                  data: workflowData(item.workflow_data),
                  updatedAt: item.workflow_updated_at,
                };
                const itemPhases = phasesFor(item);
                const input = primaryInput(item);
                return (
                  <button
                    type="button"
                    className="terminal-order-card"
                    key={item.id}
                    onClick={() => {
                      setMessage("");
                      openIdentification(item.id);
                    }}
                  >
                    <span className="terminal-order-status">
                      {itemProgress.phase === 1 ? "Nova ordem" : "Em andamento"}
                    </span>
                    <h2>{input?.product_name ?? "Produção"}</h2>
                    <p className="terminal-order-quantity">
                      {input
                        ? quantity(input.quantity, input.unit)
                        : item.input_summary}
                    </p>
                    <dl>
                      <div>
                        <dt>Lote</dt>
                        <dd>{item.code}</dd>
                      </div>
                      <div>
                        <dt>Etapa atual</dt>
                        <dd>
                          {itemProgress.phase} de 6 ·{" "}
                          {itemPhases[itemProgress.phase - 1].shortTitle}
                        </dd>
                      </div>
                      <div className="terminal-order-responsible">
                        <dt>Responsável atual</dt>
                        <dd>
                          {itemProgress.data.responsibleOperatorName ??
                            "Aguardando identificação"}
                        </dd>
                      </div>
                    </dl>
                    <span className="terminal-order-open">
                      Abrir produção <span aria-hidden="true">→</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <section className="terminal-empty">
              <span aria-hidden="true">✓</span>
              <h2>Nenhuma produção aguardando</h2>
              <p>
                Quando uma fruta for enviada do estoque, a ordem aparecerá aqui.
              </p>
            </section>
          )}
        </main>
        {renderPinDialog()}
      </div>
    );
  }

  const input = primaryInput(run);

  return (
    <div className="terminal-shell terminal-workspace">
      <header className="terminal-order-header">
        <button
          type="button"
          className="terminal-back"
          onClick={() => {
            setSelectedRunId(undefined);
            setMessage("");
            router.replace("/dashboard/producao", { scroll: false });
          }}
        >
          <span aria-hidden="true">←</span> Voltar à fila
        </button>
        <div className="terminal-order-title">
          <span>{run.code}</span>
          <strong>{input?.product_name ?? "Produção"}</strong>
        </div>
        <div className="terminal-order-meta">
          <span>Quantidade recebida</span>
          <strong>
            {input ? quantity(input.quantity, input.unit) : run.input_summary}
          </strong>
        </div>
        <button
          type="button"
          className="terminal-change-operator"
          onClick={() => openIdentification(run.id)}
        >
          <span>Responsável</span>
          <strong>
            {runProgress.data.responsibleOperatorName ?? "Identificar"}
          </strong>
          <small>Trocar com PIN</small>
        </button>
      </header>

      <nav className="terminal-phases" aria-label="Fases da produção">
        {phases.map((item, index) => {
          const number = index + 1;
          const state =
            number < runProgress.phase
              ? "complete"
              : number === runProgress.phase
                ? "current"
                : "future";
          return (
            <div
              className={`terminal-phase terminal-phase-${state}`}
              key={item.title}
            >
              <span>{state === "complete" ? "✓" : number}</span>
              <strong>{item.shortTitle}</strong>
            </div>
          );
        })}
      </nav>

      {runProgress.phase <= 4 && phase && step && (
        <main className="terminal-guide">
          <section className="terminal-guide-main">
            <div className="terminal-step-labels">
              <span>Fase {runProgress.phase} de 6</span>
              <span>
                Passo {runProgress.step} de {phase.steps.length}
              </span>
            </div>
            <h1>{step.title}</h1>
            <p className="terminal-instruction">{step.instruction}</p>

            {step.checklist && (
              <ul className="terminal-checklist">
                {step.checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}

            {step.kind === "package" && (
              <div className="terminal-package-options">
                {[100, 500].map((size) => {
                  const selected = runProgress.data.packageSizeG === size;
                  return (
                    <button
                      type="button"
                      key={size}
                      className={selected ? "is-selected" : ""}
                      aria-pressed={selected}
                      onClick={() => {
                        setMessage("");
                        setProgress((current) => ({
                          ...current,
                          [run.id]: {
                            ...runProgress,
                            data: {
                              ...runProgress.data,
                              packageSizeG: size as 100 | 500,
                            },
                          },
                        }));
                      }}
                    >
                      <strong>{size} g</strong>
                      <span>por embalagem</span>
                    </button>
                  );
                })}
              </div>
            )}

            {step.kind === "line" && (
              <div className="terminal-setting-grid">
                <div>
                  <span>Lote para o datador</span>
                  <strong>{run.code}</strong>
                </div>
                <div>
                  <span>Envasadora</span>
                  <strong>
                    Regular para {runProgress.data.packageSizeG ?? "—"} g
                  </strong>
                </div>
                <div>
                  <span>Seladora</span>
                  <strong>Aplicar temperatura e velocidade aprovadas</strong>
                </div>
              </div>
            )}

            {step.kind === "confirm-weight" && (
              <div className="terminal-weight-target">
                <span>Peso definido para esta produção</span>
                <strong>{runProgress.data.packageSizeG ?? "—"} g</strong>
                <p>
                  Confirme somente depois de produzir e conferir a embalagem de
                  teste.
                </p>
              </div>
            )}

            {message && (
              <p className="terminal-message" role="alert">
                {message}
              </p>
            )}

            <div className="terminal-guide-actions">
              <button
                type="button"
                className="terminal-btn terminal-btn-muted"
                onClick={goBack}
                disabled={
                  saving || (runProgress.phase === 1 && runProgress.step === 1)
                }
              >
                Voltar
              </button>
              <button
                type="button"
                className="terminal-btn terminal-btn-primary"
                onClick={advance}
                disabled={saving}
              >
                {saving ? "Salvando…" : (step.action ?? "Concluído, continuar")}
              </button>
            </div>
          </section>
          <aside className="terminal-order-summary">
            <span>Ordem atual</span>
            <h2>{input?.product_name ?? "Produção"}</h2>
            <dl>
              <div>
                <dt>Quantidade</dt>
                <dd>
                  {input
                    ? quantity(input.quantity, input.unit)
                    : run.input_summary}
                </dd>
              </div>
              <div>
                <dt>Lote</dt>
                <dd>{run.code}</dd>
              </div>
              <div>
                <dt>Início</dt>
                <dd>{dateTime(run.started_at)}</dd>
              </div>
              <div>
                <dt>Responsável</dt>
                <dd>{runProgress.data.responsibleOperatorName}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="terminal-problem"
              onClick={() => setIssueOpen(true)}
            >
              Informar problema
            </button>
          </aside>
        </main>
      )}

      {runProgress.phase === 5 && (
        <main
          className={`terminal-running ${runProgress.data.paused ? "is-paused" : ""}`}
        >
          <section className="terminal-running-panel">
            <div className="terminal-running-heading">
              <span className="terminal-live-dot" aria-hidden="true" />
              <strong>
                {runProgress.data.paused
                  ? "PRODUÇÃO PAUSADA"
                  : "PRODUÇÃO EM ANDAMENTO"}
              </strong>
            </div>
            <h1>{input?.product_name ?? "Produção"}</h1>
            <div className="terminal-running-facts">
              <div>
                <span>Gramatura</span>
                <strong>{runProgress.data.packageSizeG ?? "—"} g</strong>
              </div>
              <div>
                <span>Responsável</span>
                <strong>{runProgress.data.responsibleOperatorName}</strong>
              </div>
            </div>
            {!runProgress.data.packageSizeG && (
              <div className="terminal-running-warning" role="alert">
                <strong>Falta definir a gramatura desta produção</strong>
                <p>
                  Escolha o tamanho da embalagem antes de continuar ou encerrar.
                </p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    persist(run, {
                      phase: 4,
                      step: 1,
                      data: runProgress.data,
                    })
                  }
                >
                  DEFINIR GRAMATURA
                </button>
              </div>
            )}
            <div className="terminal-timer" aria-label="Tempo de produção">
              <span>Tempo de produção</span>
              <strong>
                {clock
                  ? elapsedLabel(
                      runProgress.data.productionStartedAt ??
                        runProgress.updatedAt,
                      clock,
                      runProgress.data.paused
                        ? runProgress.data.pausedAt
                        : undefined,
                      runProgress.data.accumulatedPausedSeconds,
                    )
                  : "00:00:00"}
              </strong>
            </div>
            {message && (
              <p className="terminal-message" role="status">
                {message}
              </p>
            )}
            <div className="terminal-running-actions">
              <button
                type="button"
                className="terminal-action-pause"
                onClick={togglePause}
                disabled={saving}
              >
                {runProgress.data.paused ? "▶ RETOMAR" : "Ⅱ PAUSAR"}
              </button>
              <button
                type="button"
                className="terminal-action-problem"
                onClick={() => setIssueOpen(true)}
              >
                ! INFORMAR PROBLEMA
              </button>
              <button
                type="button"
                className="terminal-action-finish"
                disabled={
                  saving ||
                  runProgress.data.paused ||
                  !runProgress.data.packageSizeG
                }
                onClick={() =>
                  persist(run, {
                    phase: 6,
                    step: 1,
                    data: {
                      ...runProgress.data,
                      productionEndedAt: new Date().toISOString(),
                    },
                  })
                }
              >
                ENCERRAR PRODUÇÃO →
              </button>
            </div>
          </section>
        </main>
      )}

      {runProgress.phase === 6 && (
        <main className="terminal-finish">
          <div className="terminal-finish-heading">
            <span>Fase 6 de 6</span>
            <h1>Finalizar e armazenar</h1>
            <p>
              Registre o rendimento e indique em qual freezer a polpa ficará.
            </p>
            <button
              type="button"
              className="terminal-btn terminal-btn-muted terminal-finish-back"
              disabled={saving}
              onClick={() =>
                persist(run, {
                  phase: 5,
                  step: 1,
                  data: runProgress.data,
                })
              }
            >
              ← Voltar à produção
            </button>
          </div>
          <div className="terminal-finish-form">
            {!runProgress.data.packageSizeG ? (
              <div className="terminal-running-warning" role="alert">
                <strong>Defina a gramatura antes de finalizar</strong>
                <p>
                  O sistema precisa desse dado para calcular o peso do lote
                  congelado.
                </p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    persist(run, {
                      phase: 4,
                      step: 1,
                      data: runProgress.data,
                    })
                  }
                >
                  DEFINIR GRAMATURA
                </button>
              </div>
            ) : variants.length && locations.length ? (
              <CompleteProductionForm
                productionId={run.id}
                requestId={completionRequestId}
                now={now}
                variants={variants}
                locations={locations}
                terminalMode={{
                  packageSizeG: runProgress.data.packageSizeG,
                  defaultVariantId: outputVariantId(
                    run,
                    variants,
                    runProgress.data.packageSizeG,
                  ),
                }}
                onSuccess={() => {
                  setSelectedRunId(undefined);
                  router.replace("/dashboard/producao", { scroll: false });
                  router.refresh();
                }}
              />
            ) : (
              <p className="terminal-message" role="alert">
                Cadastre uma polpa pronta e mantenha ao menos um freezer ativo
                para finalizar.
              </p>
            )}
          </div>
        </main>
      )}

      {issueOpen && (
        <div className="terminal-dialog-backdrop" role="presentation">
          <section
            className="terminal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="terminal-issue-title"
          >
            <span>Parar e avisar</span>
            <h2 id="terminal-issue-title">O que aconteceu?</h2>
            <textarea
              value={issue}
              onChange={(event) => setIssue(event.target.value)}
              placeholder="Descreva o problema de forma curta"
              autoFocus
            />
            <div>
              <button type="button" onClick={() => setIssueOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="terminal-btn-primary"
                onClick={saveIssue}
                disabled={saving}
              >
                Registrar e pausar
              </button>
            </div>
          </section>
        </div>
      )}
      {renderPinDialog()}
    </div>
  );
}
