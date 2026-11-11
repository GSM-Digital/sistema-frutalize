export type PreparationGuide = {
  id: string;
  productId: string;
  productName: string;
  revision: number;
  status: "draft" | "approved";
  steps: string[];
};

export type PreparationWorker = {
  id: string;
  userId: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  pausedAt: string | null;
  pausedSeconds: number;
};

export type PreparationBatch = {
  id: string;
  code: string;
  status: "active" | "completed" | "cancelled";
  sourceLotId: string;
  sourceCode: string;
  productName: string;
  productId: string;
  inputQuantity: number;
  inputUnit: string;
  startedAt: string;
  pausedAt: string | null;
  pausedSeconds: number;
  completedAt: string | null;
  processedQuantity: number | null;
  bucketCount: number | null;
  destination: "freezer" | "pulping" | null;
  locationName: string | null;
  guide: { guideId: string; revision: number; steps: string[] };
  workers: PreparationWorker[];
  outputLots: {
    id: string;
    code: string;
    quantity: number;
    weightKg: number | null;
    locationId: string;
  }[];
};

export type PreparationSnapshot = {
  serverTime: string;
  actor: { id: string; name: string; role: string };
  reminders: { workMinutes: number; restMinutes: number };
  guides: PreparationGuide[];
  products: { id: string; name: string }[];
  rawLots: {
    id: string;
    code: string;
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    locationName: string;
    expiresOn: string | null;
  }[];
  locations: { id: string; name: string }[];
  batches: PreparationBatch[];
};

export type PreparationKind =
  | "save_guide"
  | "approve_guide"
  | "set_reminders"
  | "start"
  | "join"
  | "break"
  | "resume"
  | "leave"
  | "finish"
  | "cancel";

export type PreparationCommand = {
  commandId: string;
  batchId: string | null;
  kind: PreparationKind;
  payload: Record<string, unknown>;
};

export type PreparationResult = { ok: boolean; id?: string; error?: string };
