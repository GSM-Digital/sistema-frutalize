import type { Json } from "@/lib/inventory/types";

export type ProcedureStep = {
  phase: number;
  step: number;
  title: string;
  instruction: string;
  kind: "confirm" | "quality" | "release" | "finish";
  required: boolean;
};
export type Procedure = {
  id: string;
  name: string;
  product_id: string;
  output_variant_id: string;
  revision: number;
  status?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  steps: ProcedureStep[];
};
export type MachineParameter = {
  name: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  source: string;
};
export type MachineProfile = {
  id: string;
  name: string;
  product_id: string;
  output_variant_id: string;
  equipment_id?: string;
  packaging_id?: string;
  revision: number;
  status?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  parameters: MachineParameter[];
};
export type QualitySpec = {
  id: string;
  name: string;
  output_variant_id: string;
  revision: number;
  status?: string;
  unit: string;
  minimum: number;
  maximum: number;
  tare: number;
  requires_calibration: boolean;
  approved_by?: string | null;
  approved_at?: string | null;
};
export type TerminalRun = {
  id: string;
  code: string;
  revision: number;
  status: string;
  operational_status: string;
  phase: number;
  step: number;
  operator_id: string | null;
  operator_name: string | null;
  started_at: string;
  paused_at: string | null;
  paused_seconds: number;
  procedure_id: string | null;
  profile_id: string | null;
  quality_spec_id: string | null;
  procedure: Procedure | null;
  profile: MachineProfile | null;
  qualitySpec: QualitySpec | null;
  inputs: {
    lot_id: string;
    code: string;
    product_name: string;
    quantity: number;
    unit: string;
  }[];
  qualityChecks: {
    id: string;
    net: number;
    unit: string;
    passed: boolean;
    created_at: string;
    instrument_name: string;
  }[];
  nonconformities: {
    id: string;
    status: string;
    reason: string;
    decision: string | null;
  }[];
  output_lot_id: string | null;
  output_variant_id: string | null;
  updated_at: string;
};
export type TerminalSnapshot = {
  actor: { id: string; name: string; role: string };
  serverTime: string;
  runs: TerminalRun[];
  locations: { id: string; name: string }[];
  instruments: { id: string; name: string }[];
  procedures: Procedure[];
  profiles: MachineProfile[];
  qualitySpecs: QualitySpec[];
  lots: {
    id: string;
    code: string;
    product_name: string;
    product_id?: string;
    quantity: number;
    unit: string;
  }[];
};
export type ProductionCommand = {
  commandId: string;
  runId: string | null;
  expectedRevision: number;
  kind: string;
  payload: { [key: string]: Json | undefined };
};
export type ProductionCommandResult = {
  ok: boolean;
  code?: string;
  message?: string;
  revision?: number;
  eventId?: string;
  currentRevision?: number;
  snapshot?: TerminalRun;
};
export type ProductionConfiguration = {
  equipment: {
    id: string;
    name: string;
    type: string;
    manufacturer: string;
    model: string;
    active: boolean;
  }[];
  packaging: {
    id: string;
    name: string;
    presentation_g: number;
    material: string;
    active: boolean;
  }[];
  procedures: Procedure[];
  profiles: MachineProfile[];
  qualitySpecs: QualitySpec[];
  products: { id: string; name: string }[];
  variants: { id: string; name: string; product_id: string; sku: string }[];
  calibrations: {
    id: string;
    equipment_id: string;
    calibrated_at: string;
    valid_until: string;
    reference: string;
  }[];
};

export function terminalSnapshot(value: unknown): TerminalSnapshot {
  if (!value || typeof value !== "object")
    throw new Error("O terminal não recebeu um estado válido.");
  const data = value as Partial<TerminalSnapshot>;
  if (!data.actor?.id || !Array.isArray(data.runs) || !data.serverTime)
    throw new Error("O terminal não recebeu um estado válido.");
  return {
    ...data,
    locations: data.locations ?? [],
    instruments: data.instruments ?? [],
    procedures: data.procedures ?? [],
    profiles: data.profiles ?? [],
    qualitySpecs: data.qualitySpecs ?? [],
    lots: data.lots ?? [],
  } as TerminalSnapshot;
}

export function productionElapsedSeconds(run: TerminalRun, serverTime: number) {
  const end = run.paused_at ? Date.parse(run.paused_at) : serverTime;
  return Math.max(
    0,
    Math.floor(
      (end - Date.parse(run.started_at)) / 1000 - Number(run.paused_seconds),
    ),
  );
}
