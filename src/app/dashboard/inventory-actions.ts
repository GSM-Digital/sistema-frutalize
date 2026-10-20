"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import {
  externalDestinations,
  units,
  type ActionState,
} from "@/lib/inventory/types";
import {
  catalogInput,
  dateField,
  decimalField,
  deliveryInput,
  enumField,
  operationalDateField,
  receiptInput,
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
    ...saved("Recebimento registrado e disponível no estoque."),
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
    ...saved("Recebimento registrado e itens disponíveis no estoque."),
    receiptId,
  };
}
export async function registerLotOperation(
  _previous: ActionState,
  data: FormData,
): Promise<ActionState> {
  const { supabase } = await requireStaff();
  let productionId: string | undefined;
  try {
    const kind = enumField(data, "kind", [
      "production",
      "external_dispatch",
      "loss",
    ] as const);
    const common = {
      p_request_id: uuidField(data, "request_id"),
      p_lot_id: uuidField(data, "lot_id"),
      p_quantity: decimalField(data, "quantity")!,
      p_operated_at: operationalDateField(data, "operated_at"),
    };
    if (kind === "production") {
      const { data: id, error } = await supabase.rpc(
        "start_production",
        common,
      );
      if (error) return failure(error, data);
      productionId = id;
    } else {
      const reason =
        kind === "external_dispatch"
          ? externalDestinations[
              enumField(
                data,
                "reason",
                Object.keys(
                  externalDestinations,
                ) as (keyof typeof externalDestinations)[],
              )
            ]
          : "";
      const { error } = await supabase.rpc("move_stock", {
        ...common,
        p_kind: kind,
        p_reason: reason,
      });
      if (error) return failure(error, data);
    }
  } catch (error) {
    return failure(error, data);
  }
  if (productionId)
    return {
      ...saved("Item enviado para a linha de produção."),
      productionId,
    };
  return saved("Movimentação registrada.");
}

export async function completeProduction(
  _previous: ActionState,
  data: FormData,
): Promise<ActionState> {
  const { supabase } = await requireStaff();
  let lotId: string;
  try {
    const completedAt = operationalDateField(data, "completed_at");
    const expiresOn = dateField(data, "expires_on")!;
    if (expiresOn < completedAt.slice(0, 10))
      throw new ValidationError("A validade não pode anteceder a fabricação.");
    const unit = enumField(
      data,
      "unit",
      Object.keys(units) as (keyof typeof units)[],
    );
    const quantity = decimalField(data, "quantity")!;
    if (["un", "pct", "cx"].includes(unit) && !Number.isInteger(quantity))
      throw new ValidationError(
        "Unidades, pacotes e caixas exigem quantidade inteira.",
      );
    const { data: id, error } = await supabase.rpc("complete_production", {
      p_request_id: uuidField(data, "request_id"),
      p_production_id: uuidField(data, "production_id"),
      p_data: {
        variant_id: uuidField(data, "variant_id"),
        location_id: uuidField(data, "location_id"),
        completed_at: completedAt,
        expires_on: expiresOn,
        unit,
        quantity,
        net_weight_kg: decimalField(data, "net_weight_kg", 6, false, true),
        notes: textField(data, "notes", "Observações", 0, 1000),
      },
    });
    if (error) return failure(error, data);
    lotId = id;
  } catch (error) {
    return failure(error, data);
  }
  return {
    ...saved("Produção finalizada e lote adicionado ao estoque congelado."),
    lotId,
  };
}
