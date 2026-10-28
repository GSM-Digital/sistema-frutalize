"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveProductionConfiguration,
  type ConfigurationResult,
} from "@/app/terminal/actions";
import { SubmitButton } from "@/components/submit-button";
import { dateTime, quantity } from "@/lib/inventory/format";
import type { ProductionConfiguration } from "@/lib/production/ui-types";

function Field({
  label,
  name,
  type = "text",
  required = true,
  ...props
}: { label: string; name: string; type?: string; required?: boolean } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "name" | "type"
>) {
  return (
    <label className="field block">
      <span className="field-label">{label}</span>
      <input name={name} type={type} required={required} {...props} />
    </label>
  );
}
function Select({
  label,
  name,
  children,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field block">
      <span className="field-label">{label}</span>
      <select name={name} required defaultValue="">
        <option value="">Selecione</option>
        {children}
      </select>
    </label>
  );
}
function ActionForm({
  kind,
  children,
  label = "Salvar rascunho",
}: {
  kind: string;
  children: React.ReactNode;
  label?: string;
}) {
  const commandId = useRef<string | null>(null);
  const router = useRouter();
  const [state, action] = useActionState(
    async (previous: ConfigurationResult, data: FormData) => {
      commandId.current ??= crypto.randomUUID();
      data.set("command_id", commandId.current);
      try {
        const result = await saveProductionConfiguration(previous, data);
        if (result.success) {
          commandId.current = null;
          router.refresh();
        }
        return result;
      } catch {
        return {
          error:
            "A resposta não chegou. Reenvie este formulário com os mesmos dados para consultar o registro.",
        };
      }
    },
    {},
  );
  return (
    <form action={action} className="inventory-form space-y-4">
      <input type="hidden" name="kind" value={kind} />
      {children}
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="form-success" role="status">
          {state.success}
        </p>
      )}
      <SubmitButton>{label}</SubmitButton>
    </form>
  );
}
function CatalogSelects({
  data,
  product = true,
}: {
  data: ProductionConfiguration;
  product?: boolean;
}) {
  return (
    <>
      {product && (
        <Select label="Produto de origem" name="product_id">
          {data.products.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      )}
      <Select label="Apresentação de saída" name="output_variant_id">
        {data.variants.map((item) => (
          <option key={item.id} value={item.id}>
            {
              data.products.find((product) => product.id === item.product_id)
                ?.name
            }{" "}
            · {item.name} · {item.sku}
          </option>
        ))}
      </Select>
      <Field label="Nome da versão" name="name" maxLength={160} />
      <Field label="Revisão" name="revision" type="number" min={1} step={1} />
    </>
  );
}
function Steps() {
  const [rows, setRows] = useState([0]);
  return (
    <fieldset className="space-y-4">
      <legend>Instruções do procedimento aprovado</legend>
      <p className="muted text-sm">
        Organize as fases de 1 a 6 e os passos de 1 a 12. Inclua medição,
        liberação da linha e finalização, com a finalização por último.
      </p>
      {rows.map((id, index) => (
        <div
          className="rounded-xl border border-[#d9e1d4] p-4 space-y-3"
          key={id}
        >
          <div className="flex items-center justify-between">
            <strong className="text-sm">Instrução {index + 1}</strong>
            {rows.length > 1 && (
              <button
                type="button"
                className="text-link text-sm"
                onClick={() =>
                  setRows((current) => current.filter((row) => row !== id))
                }
              >
                Remover
              </button>
            )}
          </div>
          <div className="form-grid">
            <Field
              label="Fase"
              name="step_phase"
              type="number"
              min={1}
              max={6}
              step={1}
            />
            <Field
              label="Passo na fase"
              name="step_order"
              type="number"
              min={1}
              max={12}
              step={1}
            />
          </div>
          <Field
            label="Título da instrução"
            name="step_title"
            maxLength={160}
          />
          <label className="field block">
            <span className="field-label">Instrução validada</span>
            <textarea
              name="step_instruction"
              rows={3}
              maxLength={4000}
              required
            />
          </label>
          <Select label="Confirmação exigida" name="step_kind">
            <option value="confirm">Confirmação do operador</option>
            <option value="quality">Medição de qualidade</option>
            <option value="release">
              Liberação da linha com teste conforme
            </option>
            <option value="finish">Conferência final</option>
          </Select>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-secondary"
        disabled={rows.length >= 72}
        onClick={() =>
          setRows((current) => [...current, Math.max(...current) + 1])
        }
      >
        Adicionar instrução
      </button>
    </fieldset>
  );
}
function Parameters() {
  const [rows, setRows] = useState([0]);
  return (
    <fieldset className="space-y-4">
      <legend>Parâmetros da máquina</legend>
      {rows.map((id, index) => (
        <div
          className="rounded-xl border border-[#d9e1d4] p-4 space-y-3"
          key={id}
        >
          <div className="flex items-center justify-between">
            <strong className="text-sm">Parâmetro {index + 1}</strong>
            {rows.length > 1 && (
              <button
                type="button"
                className="text-link text-sm"
                onClick={() =>
                  setRows((current) => current.filter((row) => row !== id))
                }
              >
                Remover
              </button>
            )}
          </div>
          <Field
            label="Nome do parâmetro"
            name="parameter_name"
            maxLength={120}
          />
          <div className="form-grid">
            <Field
              label="Valor aprovado"
              name="parameter_value"
              type="number"
              step="any"
            />
            <Field label="Unidade" name="parameter_unit" maxLength={24} />
            <Field
              label="Limite mínimo"
              name="parameter_min"
              type="number"
              step="any"
            />
            <Field
              label="Limite máximo"
              name="parameter_max"
              type="number"
              step="any"
            />
          </div>
          <Field
            label="Origem e referência (manual, teste ou aprovação)"
            name="parameter_source"
            minLength={3}
            maxLength={240}
          />
        </div>
      ))}
      <button
        className="btn btn-secondary"
        type="button"
        disabled={rows.length >= 30}
        onClick={() =>
          setRows((current) => [...current, Math.max(...current) + 1])
        }
      >
        Adicionar parâmetro
      </button>
    </fieldset>
  );
}

export function ProductionConfigurationPanel({
  data,
}: {
  data: ProductionConfiguration;
}) {
  const versions = [
    ...data.procedures.map((item) => ({
      ...item,
      entity: "procedure",
      label: "Procedimento",
    })),
    ...data.profiles.map((item) => ({
      ...item,
      entity: "profile",
      label: "Perfil de máquina",
    })),
    ...data.qualitySpecs.map((item) => ({
      ...item,
      entity: "quality",
      label: "Regra de qualidade",
    })),
  ];
  return (
    <div className="space-y-6">
      <p className="notice">
        Cadastre somente informações verificadas com os responsáveis. Cada
        alteração gera um rascunho de revisão; a liberação exige revisão e
        aprovação registradas.
      </p>
      <section className="panel p-5 sm:p-7">
        <h2 className="text-lg font-semibold">Revisões e aprovações</h2>
        {versions.length === 0 && (
          <p className="muted mt-3">
            Nenhuma revisão cadastrada. Comece pelos equipamentos, embalagens e
            versões abaixo.
          </p>
        )}
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {versions.map((item) => (
            <article
              key={`${item.entity}-${item.id}`}
              className="rounded-xl border border-[#d9e1d4] p-4"
            >
              <p className="eyebrow">{item.label}</p>
              <h3 className="mt-2 font-semibold">
                {item.name} · Rev. {item.revision}
              </h3>
              <p className="mt-2">
                <span className="badge">
                  {{
                    draft: "Rascunho",
                    review: "Em revisão",
                    approved: "Aprovado",
                    retired: "Retirado",
                  }[item.status ?? "draft"] ?? item.status}
                </span>
              </p>
              {item.approved_at && (
                <p className="muted mt-2 text-xs">
                  Aprovado em {dateTime(item.approved_at)} · Responsável{" "}
                  {item.approved_by}
                </p>
              )}
              <details className="mt-3 text-sm">
                <summary className="text-link cursor-pointer">
                  Consultar conteúdo desta versão
                </summary>
                <div className="mt-3 space-y-2">
                  {"steps" in item &&
                    item.steps.map((step) => (
                      <p key={`${step.phase}-${step.step}`}>
                        <strong>
                          {step.phase}.{step.step} · {step.title}
                        </strong>
                        <br />
                        {step.instruction}
                      </p>
                    ))}
                  {"parameters" in item &&
                    item.parameters.map((parameter) => (
                      <p key={parameter.name}>
                        <strong>{parameter.name}</strong>:{" "}
                        {quantity(Number(parameter.value), parameter.unit)} ·{" "}
                        {parameter.source}
                      </p>
                    ))}
                  {"minimum" in item && (
                    <p>
                      Peso líquido: {quantity(Number(item.minimum))} a{" "}
                      {quantity(Number(item.maximum), item.unit)}. Tara:{" "}
                      {quantity(Number(item.tare), item.unit)}.
                    </p>
                  )}
                </div>
              </details>
              {item.status !== "retired" && (
                <div className="mt-4">
                  <ActionForm
                    kind={
                      item.status === "draft"
                        ? "review"
                        : item.status === "review"
                          ? "approve"
                          : "retire"
                    }
                    label={
                      item.status === "draft"
                        ? "Enviar para revisão"
                        : item.status === "review"
                          ? "Aprovar esta revisão"
                          : "Retirar de novas ordens"
                    }
                  >
                    <input type="hidden" name="entity" value={item.entity} />
                    <input type="hidden" name="id" value={item.id} />
                    <Field
                      label="Motivo e referência da decisão"
                      name="reason"
                      minLength={3}
                      maxLength={1000}
                    />
                    {item.status === "review" && (
                      <label className="flex gap-2 text-sm leading-6">
                        <input type="checkbox" required /> Confirmo a aprovação
                        técnica deste conteúdo e sua aplicação às novas ordens.
                      </label>
                    )}
                  </ActionForm>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="panel p-5 sm:p-7">
        <h2 className="text-lg font-semibold">Equipamentos e instrumentos</h2>
        <ul className="my-4 space-y-2 text-sm">
          {data.equipment.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong> · {item.manufacturer} {item.model} ·{" "}
              {item.active ? "Ativo" : "Arquivado"}
            </li>
          ))}
        </ul>
        <details>
          <summary className="text-link cursor-pointer">
            Cadastrar equipamento
          </summary>
          <div className="mt-5">
            <ActionForm kind="save_equipment" label="Cadastrar equipamento">
              <div className="form-grid">
                <Field
                  label="Nome de identificação"
                  name="name"
                  maxLength={160}
                />
                <Select label="Tipo" name="type">
                  {[
                    ["pulper", "Despolpadeira"],
                    ["filler", "Envasadora"],
                    ["sealer", "Seladora"],
                    ["coder", "Datador"],
                    ["scale", "Balança"],
                    ["instrument", "Instrumento de medição"],
                    ["other", "Outro equipamento"],
                  ].map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </Select>
                <Field
                  label="Fabricante"
                  name="manufacturer"
                  required={false}
                  maxLength={160}
                />
                <Field
                  label="Modelo"
                  name="model"
                  required={false}
                  maxLength={160}
                />
              </div>
            </ActionForm>
          </div>
        </details>
      </section>
      <section className="panel p-5 sm:p-7">
        <h2 className="text-lg font-semibold">Embalagens</h2>
        <ul className="my-4 space-y-2 text-sm">
          {data.packaging.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong> ·{" "}
              {quantity(Number(item.presentation_g), "g")} · {item.material}
            </li>
          ))}
        </ul>
        <details>
          <summary className="text-link cursor-pointer">
            Cadastrar embalagem
          </summary>
          <div className="mt-5">
            <ActionForm kind="save_packaging" label="Cadastrar embalagem">
              <div className="form-grid">
                <Field label="Nome" name="name" maxLength={160} />
                <Field
                  label="Apresentação real em gramas"
                  name="presentation_g"
                  type="number"
                  min="0.001"
                  step="0.001"
                />
                <Field
                  label="Material e identificação"
                  name="material"
                  maxLength={160}
                />
              </div>
            </ActionForm>
          </div>
        </details>
      </section>
      <section className="panel p-5 sm:p-7">
        <h2 className="text-lg font-semibold">Novo procedimento</h2>
        <p className="muted mt-2 text-sm">
          Para alterar um procedimento existente, cadastre uma nova revisão com
          o conteúdo completo.
        </p>
        <details className="mt-4">
          <summary className="text-link cursor-pointer">
            Criar rascunho de procedimento
          </summary>
          <div className="mt-5">
            <ActionForm kind="save_procedure">
              <div className="form-grid">
                <CatalogSelects data={data} />
              </div>
              <Steps />
            </ActionForm>
          </div>
        </details>
      </section>
      <section className="panel p-5 sm:p-7">
        <h2 className="text-lg font-semibold">Novo perfil de máquina</h2>
        <details className="mt-4">
          <summary className="text-link cursor-pointer">
            Criar rascunho de perfil
          </summary>
          <div className="mt-5">
            <ActionForm kind="save_profile">
              <div className="form-grid">
                <CatalogSelects data={data} />
                <Select label="Equipamento" name="equipment_id">
                  {data.equipment
                    .filter((item) => item.active)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </Select>
                <Select label="Embalagem" name="packaging_id">
                  {data.packaging
                    .filter((item) => item.active)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ·{" "}
                        {quantity(Number(item.presentation_g), "g")}
                      </option>
                    ))}
                </Select>
              </div>
              <Parameters />
            </ActionForm>
          </div>
        </details>
      </section>
      <section className="panel p-5 sm:p-7">
        <h2 className="text-lg font-semibold">Nova regra de qualidade</h2>
        <details className="mt-4">
          <summary className="text-link cursor-pointer">
            Criar rascunho de regra
          </summary>
          <div className="mt-5">
            <ActionForm kind="save_quality_spec">
              <div className="form-grid">
                <CatalogSelects data={data} product={false} />
                <Select label="Unidade da medição" name="unit">
                  <option value="g">Gramas</option>
                  <option value="kg">Quilogramas</option>
                </Select>
                <Field
                  label="Peso líquido mínimo aprovado"
                  name="minimum"
                  type="number"
                  min="0"
                  step="0.001"
                />
                <Field
                  label="Peso líquido máximo aprovado"
                  name="maximum"
                  type="number"
                  min="0.001"
                  step="0.001"
                />
                <Field
                  label="Tara aprovada"
                  name="tare"
                  type="number"
                  min="0"
                  step="0.001"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="requires_calibration" /> Exigir
                calibração vigente do instrumento
              </label>
            </ActionForm>
          </div>
        </details>
      </section>
      <section className="panel p-5 sm:p-7">
        <h2 className="text-lg font-semibold">Calibrações dos instrumentos</h2>
        <ul className="my-4 space-y-2 text-sm">
          {data.calibrations.map((item) => (
            <li key={item.id}>
              {
                data.equipment.find(
                  (equipment) => equipment.id === item.equipment_id,
                )?.name
              }{" "}
              · Válida até {dateTime(item.valid_until)} · {item.reference}
            </li>
          ))}
        </ul>
        <details>
          <summary className="text-link cursor-pointer">
            Registrar calibração
          </summary>
          <div className="mt-5">
            <ActionForm kind="calibrate" label="Registrar calibração">
              <div className="form-grid">
                <Select label="Instrumento" name="equipment_id">
                  {data.equipment
                    .filter(
                      (item) =>
                        item.active &&
                        ["scale", "instrument"].includes(item.type),
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </Select>
                <Field
                  label="Certificado ou referência"
                  name="reference"
                  maxLength={240}
                />
                <Field
                  label="Realizada em (Brasília)"
                  name="calibrated_at"
                  type="datetime-local"
                />
                <Field
                  label="Válida até (Brasília)"
                  name="valid_until"
                  type="datetime-local"
                />
              </div>
            </ActionForm>
          </div>
        </details>
      </section>
    </div>
  );
}
