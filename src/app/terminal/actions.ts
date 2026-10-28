"use server";

import { redirect } from "next/navigation";
import { getProductionAccess, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/inventory/types";
import { isUuid, ValidationError } from "@/lib/inventory/validation";
import {
  terminalSnapshot,
  type ProductionCommand,
  type ProductionCommandResult,
} from "@/lib/production/ui-types";

const commandKinds = new Set([
  "create",
  "configure",
  "claim",
  "confirm_step",
  "quality_check",
  "pause",
  "resume",
  "issue",
  "resolve_nonconformity",
  "complete",
  "cancel",
]);

function databaseMessage(error: { code?: string; message?: string }) {
  if (error.code === "42501")
    return "Seu acesso não permite esta operação. Entre novamente ou chame o responsável.";
  if (error.code === "P0001")
    return error.message ?? "A operação foi recusada. Confira os dados.";
  return "Não foi possível concluir a operação. Atualize o estado e tente novamente.";
}

export async function loadTerminalSnapshot() {
  const access = await getProductionAccess();
  if (access.status !== "ready") throw new Error("Acesso não autorizado.");
  const { data, error } = await access.supabase.rpc(
    "production_terminal_snapshot",
  );
  if (error) throw new Error(databaseMessage(error));
  return terminalSnapshot(data);
}

export async function sendProductionCommand(
  command: ProductionCommand,
): Promise<ProductionCommandResult> {
  const access = await getProductionAccess();
  if (access.status !== "ready")
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Seu acesso foi bloqueado. Entre novamente.",
    };
  if (
    !command ||
    !isUuid(command.commandId) ||
    (command.kind === "create"
      ? command.runId !== null
      : !isUuid(command.runId ?? "")) ||
    !Number.isSafeInteger(command.expectedRevision) ||
    command.expectedRevision < 0 ||
    !commandKinds.has(command.kind) ||
    !command.payload ||
    Array.isArray(command.payload) ||
    typeof command.payload !== "object" ||
    JSON.stringify(command.payload).length > 30000
  )
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: "Solicitação inválida. Recarregue o terminal.",
    };
  const { data, error } = await access.supabase.rpc("production_command", {
    p_command_id: command.commandId,
    p_run_id: command.runId,
    p_expected_revision: command.expectedRevision,
    p_kind: command.kind,
    p_payload: command.payload,
  });
  if (error)
    return {
      ok: false,
      code: error.code === "42501" ? "FORBIDDEN" : "REJECTED",
      message: databaseMessage(error),
    };
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !("ok" in data)
  )
    throw new Error("Resposta incompleta. Consulte novamente o mesmo comando.");
  return data as unknown as ProductionCommandResult;
}

export async function lockTerminal() {
  const client = await createClient();
  await client.auth.signOut();
  redirect("/login?retorno=%2Fterminal");
}

export type ConfigurationResult = { error?: string; success?: string };

function string(data: FormData, name: string, required = true, max = 1000) {
  const value = String(data.get(name) ?? "").trim();
  if ((required && !value) || value.length > max)
    throw new ValidationError(`Preencha corretamente o campo ${name}.`);
  return value;
}
function number(data: FormData, name: string, positive = false) {
  const text = string(data, name);
  const value = Number(text.replace(",", "."));
  if (!Number.isFinite(value) || (positive && value <= 0))
    throw new ValidationError("Confira os valores numéricos informados.");
  return value;
}
function id(data: FormData, name: string) {
  const value = string(data, name);
  if (!isUuid(value))
    throw new ValidationError("Selecione um cadastro válido.");
  return value;
}

export async function saveProductionConfiguration(
  _previous: ConfigurationResult,
  data: FormData,
): Promise<ConfigurationResult> {
  const { supabase } = await requireStaff();
  try {
    const kind = string(data, "kind");
    const payload: Record<string, Json> = {};
    if (kind === "save_equipment") {
      for (const key of ["name", "type", "manufacturer", "model"])
        payload[key] = string(data, key, key === "name" || key === "type", 160);
      if (
        ![
          "pulper",
          "filler",
          "sealer",
          "coder",
          "scale",
          "instrument",
          "other",
        ].includes(String(payload.type))
      )
        throw new ValidationError("Tipo de equipamento inválido.");
    } else if (kind === "save_packaging") {
      payload.name = string(data, "name", true, 160);
      payload.material = string(data, "material", true, 160);
      payload.presentation_g = number(data, "presentation_g", true);
    } else if (
      ["save_procedure", "save_profile", "save_quality_spec"].includes(kind)
    ) {
      payload.name = string(data, "name", true, 160);
      payload.output_variant_id = id(data, "output_variant_id");
      payload.revision = number(data, "revision", true);
      if (!Number.isSafeInteger(payload.revision))
        throw new ValidationError(
          "A revisão deve ser um número inteiro positivo.",
        );
      if (kind !== "save_quality_spec")
        payload.product_id = id(data, "product_id");
      if (kind === "save_procedure") {
        const titles = data.getAll("step_title");
        if (!titles.length || titles.length > 72)
          throw new ValidationError(
            "Inclua de uma a 72 instruções no procedimento.",
          );
        payload.steps = titles.map((title, index) => {
          const instruction = String(
            data.getAll("step_instruction")[index] ?? "",
          ).trim();
          const phase = Number(data.getAll("step_phase")[index]);
          const step = Number(data.getAll("step_order")[index]);
          const kind = String(data.getAll("step_kind")[index]);
          if (
            !String(title).trim() ||
            String(title).length > 160 ||
            !instruction ||
            instruction.length > 4000 ||
            !Number.isInteger(phase) ||
            phase < 1 ||
            phase > 6 ||
            !Number.isInteger(step) ||
            step < 1 ||
            step > 12 ||
            !["confirm", "quality", "release", "finish"].includes(kind)
          )
            throw new ValidationError(
              "Confira o título, a instrução e a ordem de cada passo.",
            );
          return {
            title: String(title).trim(),
            instruction,
            phase,
            step,
            kind,
            required: true,
          };
        });
      } else if (kind === "save_profile") {
        payload.equipment_id = id(data, "equipment_id");
        payload.packaging_id = id(data, "packaging_id");
        const names = data.getAll("parameter_name");
        if (!names.length || names.length > 30)
          throw new ValidationError("Inclua de um a 30 parâmetros aprováveis.");
        payload.parameters = names.map((name, index) => {
          const value = Number(data.getAll("parameter_value")[index]);
          const min = Number(data.getAll("parameter_min")[index]);
          const max = Number(data.getAll("parameter_max")[index]);
          const unit = String(
            data.getAll("parameter_unit")[index] ?? "",
          ).trim();
          const source = String(
            data.getAll("parameter_source")[index] ?? "",
          ).trim();
          if (
            !String(name).trim() ||
            !unit ||
            !source ||
            ![value, min, max].every(Number.isFinite) ||
            min > max ||
            value < min ||
            value > max
          )
            throw new ValidationError(
              "Cada parâmetro precisa de nome, valor, unidade, limites e origem válidos.",
            );
          return { name: String(name).trim(), value, unit, min, max, source };
        });
      } else {
        payload.unit = string(data, "unit", true, 12);
        payload.minimum = number(data, "minimum");
        payload.maximum = number(data, "maximum");
        payload.tare = number(data, "tare");
        payload.requires_calibration =
          data.get("requires_calibration") === "on";
        if (
          Number(payload.minimum) < 0 ||
          Number(payload.minimum) > Number(payload.maximum) ||
          Number(payload.tare) < 0
        )
          throw new ValidationError(
            "Confira os limites e a tara da regra de qualidade.",
          );
      }
    } else if (["review", "approve", "retire"].includes(kind)) {
      payload.entity = string(data, "entity");
      if (!["procedure", "profile", "quality"].includes(String(payload.entity)))
        throw new ValidationError("Registro inválido para revisão.");
      payload.id = id(data, "id");
      payload.reason = string(data, "reason", true, 1000);
    } else if (kind === "calibrate") {
      payload.equipment_id = id(data, "equipment_id");
      payload.reference = string(data, "reference", true, 240);
      for (const key of ["calibrated_at", "valid_until"]) {
        const value = string(data, key);
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
          throw new ValidationError(
            "Informe data e hora válidas para a calibração.",
          );
        payload[key] = `${value}:00-03:00`;
      }
    } else throw new ValidationError("Operação de configuração inválida.");
    const { data: result, error } = await supabase.rpc(
      "production_admin_command",
      {
        p_command_id: id(data, "command_id"),
        p_kind: kind,
        p_payload: payload,
      },
    );
    if (error) return { error: databaseMessage(error) };
    if (
      result &&
      typeof result === "object" &&
      !Array.isArray(result) &&
      result.ok === false
    )
      return { error: String(result.message ?? "Configuração recusada.") };
    return {
      success:
        "Registro salvo. Atualize a lista para consultar a nova revisão.",
    };
  } catch (error) {
    return {
      error:
        error instanceof ValidationError
          ? error.message
          : "Não foi possível salvar a configuração.",
    };
  }
}
