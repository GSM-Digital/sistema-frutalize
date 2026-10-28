"use server";

import { revalidatePath } from "next/cache";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireProductionStaff } from "@/lib/auth";
import { parseOperation } from "@/lib/operations/validation";
import { isUuid, ValidationError } from "@/lib/inventory/validation";
import type { Json } from "@/lib/inventory/types";

export type OperationState = {
  error?: string;
  success?: string;
  uncertain?: boolean;
  id?: string;
};
function failed(error: unknown): OperationState {
  if (error instanceof ValidationError) return { error: error.message };
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "42501")
      return { error: "Seu acesso não permite esta operação." };
    if (error.code === "P0001" && "message" in error)
      return { error: String(error.message).slice(0, 350) };
    if (
      ["23514", "23502", "23503", "22P02", "22007", "22008"].includes(
        String(error.code),
      )
    )
      return { error: "Confira os valores, datas e vínculos informados." };
    if (error.code === "23505")
      return {
        error:
          "Esta referência já foi registrada. Confira o histórico antes de repetir.",
      };
  }
  return {
    error:
      "A resposta não pôde ser confirmada. Reenvie com os mesmos dados para consultar o resultado sem duplicar a operação.",
    uncertain: true,
  };
}
function adminAuth() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function submitOperation(form: FormData): Promise<OperationState> {
  const { supabase } = await requireProductionStaff();
  try {
    const { module, action, commandId, payload } = parseOperation(form);
    if (module === "receiving" && action === "inspect") {
      const { data, error } = await supabase.rpc("operations_snapshot", {
        p_module: "receiving",
      });
      if (error) return failed(error);
      const snapshot = data as {
        templates?: {
          id: string;
          criteria: {
            key: string;
            label: string;
            type: string;
            required: boolean;
          }[];
        }[];
      };
      const template = snapshot.templates?.find(
        (item) => item.id === payload.template_id,
      );
      if (!template)
        throw new ValidationError("Checklist indisponível. Atualize a página.");
      const responses: Record<string, Json> = {};
      for (const criterion of template.criteria) {
        const raw = String(form.get(`response.${criterion.key}`) ?? "").trim();
        if (!raw && !criterion.required) continue;
        if (!raw || raw.length > 1000)
          throw new ValidationError(`Responda: ${criterion.label}`);
        if (criterion.type === "boolean") {
          if (!["true", "false"].includes(raw))
            throw new ValidationError("Resposta inválida.");
          responses[criterion.key] = raw === "true";
        } else if (criterion.type === "number") {
          if (!/^-?\d+(\.\d{1,6})?$/.test(raw.replace(",", ".")))
            throw new ValidationError("Medição inválida.");
          responses[criterion.key] = Number(raw.replace(",", "."));
        } else responses[criterion.key] = raw;
      }
      payload.responses = responses;
    }
    const { data, error } = await supabase.rpc("operations_command", {
      p_command_id: commandId,
      p_module: module,
      p_action: action,
      p_data: payload,
    });
    if (error) return failed(error);
    let note = "Operação registrada no histórico.";
    // Database membership is the immediate enforcement boundary; Auth banning
    // additionally blocks new login/refresh when the server secret is configured.
    if (module === "staff" && ["block", "reactivate"].includes(action)) {
      const provider = adminAuth();
      if (provider) {
        const { error: authError } = await provider.auth.admin.updateUserById(
          String(payload.user_id),
          { ban_duration: action === "block" ? "876000h" : "none" },
        );
        if (authError)
          note +=
            " O vínculo foi atualizado, mas o provedor de login não confirmou a alteração; confira no Supabase Auth.";
      } else
        note +=
          " O vínculo é verificado em cada operação. O bloqueio adicional no provedor depende da configuração de acesso administrativo ao Auth.";
    }
    revalidatePath("/gestao", "layout");
    revalidatePath("/dashboard", "layout");
    return {
      success: note,
      id:
        typeof data === "object" && data && "id" in data
          ? String(data.id)
          : undefined,
    };
  } catch (error) {
    return failed(error);
  }
}

export async function inviteMember(form: FormData): Promise<OperationState> {
  const { supabase, member } = await requireProductionStaff();
  const role = String(form.get("role"));
  if (
    !["admin", "manager"].includes(member.role) ||
    !["admin", "manager", "collaborator"].includes(role) ||
    (member.role !== "admin" && role === "admin")
  )
    return { error: "Papel não permitido." };
  const provider = adminAuth();
  if (!provider)
    return {
      error:
        "O envio de convite precisa ser configurado pelo administrador do sistema.",
    };
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(form.get("display_name") ?? "").trim();
  const reason = String(form.get("reason") ?? "").trim();
  const command = form.get("command_id");
  if (
    !isUuid(command) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    name.length < 2 ||
    name.length > 120 ||
    reason.length < 3 ||
    reason.length > 240
  )
    return { error: "Confira nome, e-mail e motivo do convite." };
  const base = process.env.APP_ORIGIN;
  if (!base || !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base))
    return {
      error: "O endereço seguro do primeiro acesso precisa ser configurado.",
    };
  // Supabase sends its own one-time invitation; the application never receives
  // a password to show to a manager. A failed linkage is reported explicitly.
  const { data, error } = await provider.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${base}/auth/confirm`,
    data: { display_name: name },
  });
  if (error || !data.user)
    return {
      error:
        "O convite não foi confirmado pelo provedor. Confira o usuário no Supabase Auth antes de tentar novamente.",
    };
  const { error: linkError } = await supabase.rpc("operations_command", {
    p_command_id: command,
    p_module: "staff",
    p_action: "save",
    p_data: { user_id: data.user.id, display_name: name, role, reason },
  });
  if (linkError)
    return {
      error:
        "Convite criado, mas o vínculo não foi concluído. Vincule o usuário existente no cadastro de equipe antes de liberar seu acesso.",
      id: data.user.id,
    };
  revalidatePath("/gestao/staff");
  revalidatePath("/dashboard/gestao/staff");
  return {
    success:
      "Convite enviado pelo provedor. O usuário define a própria senha no primeiro acesso.",
  };
}

export async function uploadReceipt(form: FormData): Promise<OperationState> {
  const { supabase, user, member } = await requireProductionStaff();
  if (member.role !== "admin") return { error: "Acesso não autorizado." };
  const file = form.get("file");
  const receipt = form.get("receipt_id");
  const command = form.get("command_id");
  const reason = String(form.get("reason") ?? "").trim();
  if (
    !(file instanceof File) ||
    !isUuid(receipt) ||
    !isUuid(command) ||
    reason.length < 3 ||
    reason.length > 240 ||
    file.size < 1 ||
    file.size > 10 * 1024 * 1024
  )
    return {
      error:
        "Selecione um recebimento e um arquivo JPG, PNG ou PDF de até 10 MB; informe o motivo.",
    };
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const extension =
    file.type === "image/jpeg" &&
    header[0] === 255 &&
    header[1] === 216 &&
    header[2] === 255
      ? "jpg"
      : file.type === "image/png" &&
          [137, 80, 78, 71, 13, 10, 26, 10].every(
            (value, index) => header[index] === value,
          )
        ? "png"
        : file.type === "application/pdf" &&
            new TextDecoder().decode(header.slice(0, 5)) === "%PDF-"
          ? "pdf"
          : null;
  if (!extension)
    return {
      error: "O conteúdo do arquivo não corresponde a JPG, PNG ou PDF.",
    };
  const object = `${receipt}/${user.id}/${command}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("frutalize-receipts")
    .upload(object, file, { contentType: file.type, upsert: false });
  if (
    uploadError &&
    !["409", "Duplicate"].includes(String(uploadError.statusCode)) &&
    !uploadError.message.toLowerCase().includes("already exists")
  )
    return failed(uploadError);
  const { error } = await supabase.rpc("operations_command", {
    p_command_id: command,
    p_module: "receiving",
    p_action: "attachment_register",
    p_data: {
      receipt_id: receipt,
      object_name: object,
      mime_type: file.type,
      size_bytes: file.size,
      reason,
    },
  });
  if (error) return failed(error);
  revalidatePath("/gestao/receiving");
  revalidatePath("/dashboard/gestao/receiving");
  return { success: "Documento privado vinculado ao recebimento." };
}
