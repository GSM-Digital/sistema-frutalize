import type { Json, Unit } from "@/lib/inventory/types";

export type ProductionCommandPayloads = {
  create: {
    procedure_id: string;
    profile_id: string;
    quality_spec_id: string;
    inputs: { lot_id: string; quantity: number }[];
  };
  configure: {
    procedure_id: string;
    profile_id: string;
    quality_spec_id: string;
  };
  claim: { reason?: string };
  confirm_step: { phase: number; step: number };
  quality_check: {
    gross: number;
    tare: number;
    unit: "g" | "kg" | "l" | "un";
    instrument_id: string;
  };
  pause: { reason: string; safe_point_confirmed: true };
  resume: Record<string, never>;
  issue: { reason: string };
  resolve_nonconformity: {
    id: string;
    status: "contained" | "assessed" | "closed";
    decision: string;
    reason: string;
  };
  complete: {
    location_id: string;
    quantity: number;
    unit: Unit;
    expires_on: string | null;
    notes: string;
    net_weight_kg?: number | null;
    loss_notes?: string;
  };
  cancel: {
    reason: string;
    disposition: "discarded" | "segregated";
    destination: string;
  };
};

export type ProductionCommand = {
  [Kind in keyof ProductionCommandPayloads]: {
    commandId: string;
    runId: Kind extends "create" ? null : string;
    expectedRevision: number;
    kind: Kind;
    payload: ProductionCommandPayloads[Kind];
  };
}[keyof ProductionCommandPayloads];

export type ProductionCommandResult =
  | { ok: true; revision: number; eventId: string; snapshot: Json }
  | {
      ok: false;
      code:
        | "FORBIDDEN"
        | "CONFLICT"
        | "INVALID_TRANSITION"
        | "QUALITY_BLOCK"
        | "NOT_FOUND";
      message: string;
      currentRevision?: number;
      snapshot?: Json;
    };

export const operationalStatuses = {
  preparing: "Em preparação",
  configured: "Configurada",
  in_progress: "Em produção",
  paused: "Pausada",
  awaiting_review: "Aguardando conferência",
  completed: "Concluída",
  cancelled: "Cancelada",
} as const;
