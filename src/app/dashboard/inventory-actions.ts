"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import type { ActionState } from "@/lib/inventory/types";
import {
  catalogInput,
  decimalField,
  deliveryInput,
  enumField,
  operationalDateField,
  receiptInput,
  statusInput,
  textField,
  uuidField,
  ValidationError,
} from "@/lib/inventory/validation";

function failure(error: unknown, data: FormData): ActionState {
  let message = "Não foi possível salvar. Tente novamente em instantes.";
  if (error instanceof ValidationError) message = error.message;
  else if (error && typeof error === "object" && "code" in error) {
    if (error.code === "23505")
      message = "Este código ou nome já está cadastrado. Confira os dados.";
    else if (error.code === "P0001" && "message" in error)
      message = String(error.message);
    else if (error.code === "42501")
      message = "Você não tem permissão para esta operação.";
    else if (
      ["23514", "23502", "22003", "23503", "22P02"].includes(String(error.code))
    )
      message =
        "Confira os campos, os cadastros selecionados e as quantidades informadas.";
  }
  return {
    error: message,
    values: Object.fromEntries(
      [...data.entries()]
        .filter(
          ([key, value]) =>
            typeof value === "string" && !key.startsWith("$ACTION"),
        )
        .map(([key, value]) => [key, String(value)]),
    ),
  };
}
function saved(success: string): ActionState {
  revalidatePath("/dashboard", "layout");
  return { success, successId: crypto.randomUUID() };
}
export async function saveCatalog(
  _previous: ActionState,
  data: FormData,
): Promise<ActionState> {
  const { supabase } = await requireStaff();
  let catalogId: string;
  let catalogName: string;
  try {
    const entity = enumField(data, "entity", [
      "products",
      "variants",
      "suppliers",
      "locations",
      "categories",
    ] as const);
    const values = catalogInput(entity, data);
    const { data: id, error } = await supabase.rpc("save_catalog", {
      p_entity: entity,
      p_id: data.get("id") ? uuidField(data, "id") : null,
      p_values: values,
      p_reason: textField(data, "reason", "Motivo", 3, 240),
    });
    if (error) return failure(error, data);
    catalogId = id;
    catalogName = textField(data, "name", "Nome", 1, 120);
  } catch (error) {
    return failure(error, data);
  }
  return {
    ...saved("Cadastro salvo. A alteração foi registrada no histórico."),
    catalogId,
    catalogName,
  };
}
export async function receiveLot(
  _previous: ActionState,
  data: FormData,
): Promise<ActionState> {
  const { supabase } = await requireStaff();
  let lotId: string;
  try {
    const { data: id, error } = await supabase.rpc(
      "receive_lot",
      receiptInput(data),
    );
    if (error) return failure(error, data);
    lotId = id;
  } catch (error) {
    return failure(error, data);
  }
  return {
    ...saved(
      "Recebimento registrado. O lote está em quarentena para conferência.",
    ),
    lotId,
  };
}
export async function receiveDelivery(
  _previous: ActionState,
  data: FormData,
): Promise<ActionState> {
  const { supabase } = await requireStaff();
  let receiptId: string;
  try {
    const { data: id, error } = await supabase.rpc(
      "receive_delivery",
      deliveryInput(data),
    );
    if (error) return failure(error, data);
    receiptId = id;
  } catch (error) {
    return failure(error, data);
  }
  return {
    ...saved(
      "Recebimento registrado. Os itens estão em quarentena para conferência.",
    ),
    receiptId,
  };
}
export async function moveStock(
  _previous: ActionState,
  data: FormData,
): Promise<ActionState> {
  const { supabase } = await requireStaff();
  try {
    const { error } = await supabase.rpc("move_stock", {
      p_request_id: uuidField(data, "request_id"),
      p_lot_id: uuidField(data, "lot_id"),
      p_kind: enumField(data, "kind", ["dispatch", "loss"] as const),
      p_quantity: decimalField(data, "quantity")!,
      p_reason: textField(data, "reason", "Motivo / destino", 3, 240),
      p_operated_at: operationalDateField(data, "operated_at"),
    });
    if (error) return failure(error, data);
  } catch (error) {
    return failure(error, data);
  }
  return saved("Movimentação registrada.");
}
export async function changeLotStatus(
  _previous: ActionState,
  data: FormData,
): Promise<ActionState> {
  const { supabase } = await requireStaff();
  try {
    const { error } = await supabase.rpc("set_lot_status", statusInput(data));
    if (error) return failure(error, data);
  } catch (error) {
    return failure(error, data);
  }
  return saved("Situação atualizada e registrada no histórico.");
}
