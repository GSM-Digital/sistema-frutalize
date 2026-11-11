"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import {
  externalDestinations,
  units,
  type ActionState,
  type Json,
} from "@/lib/inventory/types";
import {
  catalogInput,
  dateField,
  decimalField,
  deliveryInput,
  enumField,
  isUuid,
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
      p_reason: data.get("reason")?.toString().trim()
        ? textField(data, "reason", "Motivo", 3, 240)
        : "Registro administrativo",
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

export type BulkLossRequest = {
  lotId: string;
  requestId: string;
  quantity: number;
};

export async function removeSelectedLots(requests: BulkLossRequest[]): Promise<{
  completedIds: string[];
  failures: { id: string; message: string }[];
}> {
  const { supabase } = await requireStaff();
  if (
    !Array.isArray(requests) ||
    requests.length < 1 ||
    requests.length > 25 ||
    new Set(requests.map((item) => item.lotId)).size !== requests.length ||
    new Set(requests.map((item) => item.requestId)).size !== requests.length ||
    requests.some(
      (item) =>
        !isUuid(item.lotId) ||
        !isUuid(item.requestId) ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        item.quantity > 999999999 ||
        Number(item.quantity.toFixed(3)) !== item.quantity,
    )
  ) {
    return {
      completedIds: [],
      failures: [
        {
          id: "",
          message: "Seleção inválida. Atualize a lista e tente novamente.",
        },
      ],
    };
  }

  const { data: current, error: queryError } = await supabase
    .from("inventory_lots")
    .select("id,quantity")
    .in(
      "id",
      requests.map((item) => item.lotId),
    );
  if (
    queryError ||
    !current ||
    current.length !== requests.length ||
    requests.some(
      (item) =>
        Number(current.find((lot) => lot.id === item.lotId)?.quantity) !==
        item.quantity,
    )
  ) {
    return {
      completedIds: [],
      failures: [
        {
          id: "",
          message:
            "O saldo mudou ou um lote não está mais disponível. Atualize a lista antes de remover.",
        },
      ],
    };
  }

  const completedIds: string[] = [];
  const failures: { id: string; message: string }[] = [];
  for (const item of requests) {
    const { error } = await supabase.rpc("move_stock", {
      p_request_id: item.requestId,
      p_lot_id: item.lotId,
      p_kind: "loss",
      p_quantity: item.quantity,
      p_reason: "",
      p_operated_at: new Date().toISOString(),
    });
    if (error) {
      failures.push({
        id: item.lotId,
        message:
          error.code === "P0001"
            ? error.message
            : "Não foi possível baixar este lote.",
      });
    } else completedIds.push(item.lotId);
  }
  if (completedIds.length) revalidatePath("/dashboard", "layout");
  return { completedIds, failures };
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

export async function saveProductionProgress(input: {
  productionId: string;
  phase: number;
  step: number;
  data: Json;
}): Promise<ActionState> {
  const { supabase } = await requireStaff();
  try {
    if (!isUuid(input.productionId))
      throw new ValidationError("Produção inválida.");
    if (!Number.isInteger(input.phase) || input.phase < 1 || input.phase > 6)
      throw new ValidationError("Fase de produção inválida.");
    if (!Number.isInteger(input.step) || input.step < 1 || input.step > 12)
      throw new ValidationError("Passo de produção inválido.");
    if (
      !input.data ||
      Array.isArray(input.data) ||
      typeof input.data !== "object" ||
      JSON.stringify(input.data).length > 30000
    )
      throw new ValidationError("Dados do terminal inválidos.");

    const { error } = await supabase.rpc("save_production_progress", {
      p_production_id: input.productionId,
      p_phase: input.phase,
      p_step: input.step,
      p_data: input.data,
    });
    if (error) {
      if (error.code === "42501")
        return { error: "Você não tem permissão para esta operação." };
      if (error.code === "P0001") return { error: error.message };
      return { error: "Não foi possível salvar o andamento da produção." };
    }
  } catch (error) {
    return {
      error:
        error instanceof ValidationError
          ? error.message
          : "Não foi possível salvar o andamento da produção.",
    };
  }
  revalidatePath("/dashboard/producao");
  return { success: "Andamento salvo." };
}

export type ProductionOperatorResult = {
  error?: string;
  operator?: {
    id: string;
    name: string;
    responsibilityStartedAt: string;
  };
};

function productionPin(value: string) {
  if (!/^\d{4}$/.test(value))
    throw new ValidationError("O PIN deve ter quatro números.");
  return value;
}

export async function claimProductionOperator(input: {
  productionId: string;
  pin: string;
}): Promise<ProductionOperatorResult> {
  const { supabase } = await requireStaff();
  try {
    if (!isUuid(input.productionId))
      throw new ValidationError("Produção inválida.");
    const { data, error } = await supabase.rpc("claim_production_run", {
      p_production_id: input.productionId,
      p_pin: productionPin(input.pin),
    });
    if (error) {
      if (error.code === "42501")
        return { error: "Você não tem permissão para esta operação." };
      if (error.code === "P0001") return { error: error.message };
      return { error: "Não foi possível identificar o responsável." };
    }
    const result = data?.[0];
    if (result?.error_code === "locked")
      return {
        error:
          "Muitas tentativas incorretas. Aguarde um minuto e tente novamente.",
      };
    if (
      result?.error_code === "invalid" ||
      !result?.operator_id ||
      !result.operator_name ||
      !result.responsibility_started_at
    )
      return { error: "PIN não reconhecido." };
    revalidatePath("/dashboard/producao");
    return {
      operator: {
        id: result.operator_id,
        name: result.operator_name,
        responsibilityStartedAt: result.responsibility_started_at,
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof ValidationError
          ? error.message
          : "Não foi possível identificar o responsável.",
    };
  }
}

export async function setOwnProductionPin(input: {
  pin: string;
}): Promise<ActionState> {
  const { supabase } = await requireStaff();
  try {
    const { error } = await supabase.rpc("set_own_production_pin", {
      p_pin: productionPin(input.pin),
    });
    if (error) {
      if (error.code === "42501")
        return { error: "Você não tem permissão para esta operação." };
      if (error.code === "P0001") return { error: error.message };
      return { error: "Não foi possível configurar o PIN." };
    }
  } catch (error) {
    return {
      error:
        error instanceof ValidationError
          ? error.message
          : "Não foi possível configurar o PIN.",
    };
  }
  return { success: "PIN operacional configurado." };
}
