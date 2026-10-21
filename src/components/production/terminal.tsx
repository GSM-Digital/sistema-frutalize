"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { saveProductionProgress } from "@/app/dashboard/inventory-actions";
import { CompleteProductionForm } from "@/components/inventory/forms";
import { dateTime, quantity } from "@/lib/inventory/format";
import type {
  InventoryProductionInput,
  InventoryProductionRun,
  InventoryVariant,
  Json,
  Location,
} from "@/lib/inventory/types";

type TerminalMember = {
  user_id: string;
  display_name: string;
};

type TerminalRun = InventoryProductionRun & {
  inputs: InventoryProductionInput[];
};

type WeightCheck = { value: string; recordedAt: string };
type WorkflowData = {
  fillingOperatorId?: string;
  sealingOperatorId?: string;
  testWeightG?: string;
  productionStartedAt?: string;
  weightChecks?: WeightCheck[];
  paused?: boolean;
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
  kind?: "team" | "line" | "weight";
  action?: string;
};

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
          title: "Identifique a equipe da linha",
          instruction:
            "Selecione quem ficará responsável pelo envase e pela selagem nesta ordem.",
          kind: "team",
          action: "Equipe confirmada",
        },
        {
          title: "Configure envase, selagem e datador",
          instruction:
            "Aplique as regulagens aprovadas e configure o datador com o lote exibido na tela.",
          kind: "line",
          action: "Linha configurada",
        },
        {
          title: "Produza e pese uma embalagem de teste",
          instruction:
            "Envase uma unidade, pese o conteúdo líquido e informe o resultado.",
          kind: "weight",
          action: "Peso aprovado e liberar linha",
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

function elapsedLabel(startedAt: string, now: Date) {
  const milliseconds = Math.max(
    0,
    now.getTime() - new Date(startedAt).getTime(),
  );
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours
    ? `${hours}h ${String(minutes).padStart(2, "0")}min`
    : `${minutes} min`;
}

export function ProductionTerminal({
  runs,
  variants,
  locations,
  members,
  currentMemberId,
  initialRunId,
  now,
  completionRequestId,
}: {
  runs: TerminalRun[];
  variants: InventoryVariant[];
  locations: Location[];
  members: TerminalMember[];
  currentMemberId: string;
  initialRunId?: string;
  now: string;
  completionRequestId: string;
}) {
  const router = useRouter();
  const activeRuns = useMemo(
    () => runs.filter((run) => run.status === "in_progress"),
    [runs],
  );
  const [selectedRunId, setSelectedRunId] = useState(
    activeRuns.some((run) => run.id === initialRunId)
      ? initialRunId
      : undefined,
  );
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
  const [weight, setWeight] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [issue, setIssue] = useState("");

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

  async function advance() {
    if (!run || !runProgress || !phase || !step) return;
    const data = { ...runProgress.data };
    if (step.kind === "team") {
      data.fillingOperatorId ??= currentMemberId;
      data.sealingOperatorId ??= currentMemberId;
      if (!data.fillingOperatorId || !data.sealingOperatorId) {
        setMessage("Selecione os responsáveis pelo envase e pela selagem.");
        return;
      }
    }
    if (step.kind === "weight") {
      const numericWeight = Number(weight.replace(",", "."));
      if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
        setMessage("Informe o peso da embalagem de teste.");
        return;
      }
      data.testWeightG = weight;
    }
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
    if (await persist(run, next)) setWeight("");
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

  async function registerWeight() {
    if (!run || !runProgress) return;
    const numericWeight = Number(weight.replace(",", "."));
    if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
      setMessage("Informe um peso válido.");
      return;
    }
    const checks = [
      ...(runProgress.data.weightChecks ?? []),
      { value: weight, recordedAt: new Date().toISOString() },
    ];
    if (
      await persist(run, {
        phase: 5,
        step: 1,
        data: { ...runProgress.data, weightChecks: checks },
      })
    ) {
      setWeight("");
      setMessage("Pesagem registrada.");
    }
  }

  async function togglePause() {
    if (!run || !runProgress) return;
    await persist(run, {
      phase: 5,
      step: 1,
      data: { ...runProgress.data, paused: !runProgress.data.paused },
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

  function operatorName(id?: string) {
    return members.find((member) => member.user_id === id)?.display_name ?? "—";
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
            <button type="button" onClick={() => router.refresh()}>
              Atualizar fila
            </button>
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
                      setSelectedRunId(item.id);
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
      </div>
    );
  }

  const input = primaryInput(run);
  const fillingName = operatorName(runProgress.data.fillingOperatorId);
  const sealingName = operatorName(runProgress.data.sealingOperatorId);

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

            {step.kind === "team" && (
              <div className="terminal-team-grid">
                <label>
                  <span>Responsável pelo envase</span>
                  <select
                    value={
                      runProgress.data.fillingOperatorId ?? currentMemberId
                    }
                    onChange={(event) =>
                      setProgress((current) => ({
                        ...current,
                        [run.id]: {
                          ...runProgress,
                          data: {
                            ...runProgress.data,
                            fillingOperatorId: event.target.value,
                          },
                        },
                      }))
                    }
                  >
                    <option value="">Selecione</option>
                    {members.map((member) => (
                      <option value={member.user_id} key={member.user_id}>
                        {member.display_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Responsável pela selagem</span>
                  <select
                    value={
                      runProgress.data.sealingOperatorId ?? currentMemberId
                    }
                    onChange={(event) =>
                      setProgress((current) => ({
                        ...current,
                        [run.id]: {
                          ...runProgress,
                          data: {
                            ...runProgress.data,
                            sealingOperatorId: event.target.value,
                          },
                        },
                      }))
                    }
                  >
                    <option value="">Selecione</option>
                    {members.map((member) => (
                      <option value={member.user_id} key={member.user_id}>
                        {member.display_name}
                      </option>
                    ))}
                  </select>
                </label>
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
                  <strong>Aplicar regulagem aprovada</strong>
                </div>
                <div>
                  <span>Seladora</span>
                  <strong>Aplicar temperatura e velocidade aprovadas</strong>
                </div>
              </div>
            )}

            {step.kind === "weight" && (
              <label className="terminal-weight-field">
                <span>Peso líquido da embalagem de teste</span>
                <span className="terminal-weight-input">
                  <input
                    inputMode="decimal"
                    value={weight}
                    onChange={(event) => setWeight(event.target.value)}
                    placeholder="0"
                    aria-label="Peso líquido em gramas"
                  />
                  <strong>g</strong>
                </span>
              </label>
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
          <section className="terminal-running-status">
            <span className="terminal-live-dot" aria-hidden="true" />
            <p>
              {runProgress.data.paused
                ? "Produção pausada"
                : "Produção em andamento"}
            </p>
            <h1>{input?.product_name ?? "Produção"}</h1>
            <strong className="terminal-elapsed">
              {clock
                ? elapsedLabel(
                    runProgress.data.productionStartedAt ??
                      runProgress.updatedAt,
                    clock,
                  )
                : "0 min"}
            </strong>
            <div className="terminal-role-cards">
              <div>
                <span>Envase</span>
                <strong>{fillingName}</strong>
              </div>
              <div>
                <span>Selagem</span>
                <strong>{sealingName}</strong>
              </div>
            </div>
          </section>
          <section className="terminal-running-controls">
            <div className="terminal-weight-check">
              <div>
                <span>Controle de peso</span>
                <strong>
                  {runProgress.data.weightChecks?.length
                    ? `${runProgress.data.weightChecks.length} pesagem(ns) registrada(s)`
                    : "Nenhuma pesagem registrada"}
                </strong>
              </div>
              <label>
                <input
                  inputMode="decimal"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  placeholder="Peso em g"
                />
                <button
                  type="button"
                  onClick={registerWeight}
                  disabled={saving}
                >
                  Registrar pesagem
                </button>
              </label>
            </div>
            {message && (
              <p className="terminal-message" role="status">
                {message}
              </p>
            )}
            <div className="terminal-running-actions">
              <button type="button" onClick={togglePause} disabled={saving}>
                {runProgress.data.paused
                  ? "Retomar produção"
                  : "Pausar com segurança"}
              </button>
              <button type="button" onClick={() => setIssueOpen(true)}>
                Informar problema
              </button>
              <button
                type="button"
                className="terminal-btn-primary"
                disabled={saving || runProgress.data.paused}
                onClick={() =>
                  persist(run, { phase: 6, step: 1, data: runProgress.data })
                }
              >
                Encerrar produção
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
            {variants.length && locations.length ? (
              <CompleteProductionForm
                productionId={run.id}
                requestId={completionRequestId}
                now={now}
                variants={variants}
                locations={locations}
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
    </div>
  );
}
