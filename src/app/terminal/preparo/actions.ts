"use server";

import { getProductionAccess } from "@/lib/auth";
import { isUuid } from "@/lib/inventory/validation";
import type { Json } from "@/lib/inventory/types";
import type {
  PreparationCommand,
  PreparationResult,
  PreparationSnapshot,
} from "@/lib/preparation/types";

export async function loadPreparation(): Promise<PreparationSnapshot> {
  const access = await getProductionAccess();
  if (access.status !== "ready") throw new Error("Acesso não autorizado.");
  const { data, error } = await access.supabase.rpc("preparation_snapshot");
  if (error || !data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Não foi possível atualizar os preparos.");
  return data as unknown as PreparationSnapshot;
}

export async function sendPreparationCommand(
  command: PreparationCommand,
): Promise<PreparationResult> {
  const access = await getProductionAccess();
  if (access.status !== "ready")
    return { ok: false, error: "Seu acesso ao terminal não está ativo." };
  if (
    !isUuid(command.commandId) ||
    (command.batchId !== null && !isUuid(command.batchId)) ||
    ![
      "save_guide",
      "approve_guide",
      "set_reminders",
      "start",
      "join",
      "break",
      "resume",
      "leave",
      "finish",
      "cancel",
    ].includes(command.kind) ||
    !command.payload ||
    Array.isArray(command.payload) ||
    typeof command.payload !== "object" ||
    JSON.stringify(command.payload).length > 8000
  )
    return { ok: false, error: "Solicitação inválida." };
  const { data, error } = await access.supabase.rpc("preparation_command", {
    p_command_id: command.commandId,
    p_batch_id: command.batchId,
    p_kind: command.kind,
    p_payload: command.payload as unknown as Json,
  });
  if (error)
    return {
      ok: false,
      error:
        error.code === "42501"
          ? "Seu acesso não permite esta ação."
          : error.code === "P0001" ||
              error.code === "23514" ||
              error.code === "23505"
            ? error.message
            : "Não foi possível concluir. Atualize e tente novamente.",
    };
  if (!data || typeof data !== "object" || Array.isArray(data))
    return { ok: false, error: "Resposta incompleta. Atualize o terminal." };
  return data as PreparationResult;
}
