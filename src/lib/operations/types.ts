import type { Json } from "@/lib/inventory/types";

export const operationsModules = [
  "inventory",
  "receiving",
  "staff",
  "alerts",
  "finance",
  "commercial",
  "time",
] as const;
export type OperationsModule = (typeof operationsModules)[number];
export type OperationRow = { id: string; [field: string]: Json | undefined };
export type OperationsResult = {
  ok: true;
  id: string;
  [field: string]: Json | undefined;
};
export type OperationsSnapshot = {
  module: OperationsModule;
  role: "admin" | "manager" | "collaborator" | "customer";
  [list: string]: Json | undefined;
};

/** All mutations use one UUID per intention; retries MUST preserve that UUID and payload.
 * Numbers accept decimal strings to preserve precision. Dates use ISO 8601.
 * Failures raise a PostgreSQL exception and roll back the entire command.
 * Snapshots expose only authorized lists; absent lists must be treated as denied.
 */
export type OperationsPayloads = {
  inventory: {
    count_open: { location_id: string; reason: string };
    count_line: {
      session_id: string;
      lot_id: string;
      counted_quantity: string | number;
    };
    count_approve: { session_id: string; reason: string };
    compensate: { movement_id: string; reason: string };
  };
  receiving: {
    template_create: {
      name: string;
      criteria: {
        key: string;
        label: string;
        type: "boolean" | "number" | "text";
        required: boolean;
      }[];
      reason: string;
    };
    inspect: {
      receipt_id: string;
      template_id: string;
      decision: "accepted" | "rejected";
      responses: Record<string, Json>;
      notes: string;
      reason: string;
    };
    attachment_register: {
      receipt_id: string;
      object_name: string;
      mime_type: "image/jpeg" | "image/png" | "application/pdf";
      size_bytes: number;
      reason: string;
    };
  };
  staff: {
    save: {
      user_id: string;
      display_name: string;
      role: "admin" | "manager" | "collaborator";
      reason: string;
    };
    block: { user_id: string; reason: string };
    reactivate: { user_id: string; reason: string };
  };
  alerts: {
    rule_save: {
      id?: string;
      name: string;
      kind: "minimum_stock" | "expiry" | "temperature" | "missing_reading";
      variant_id?: string;
      category_id?: string;
      location_id?: string;
      threshold?: number | string;
      lower_limit?: number | string;
      upper_limit?: number | string;
      active: boolean;
      reason: string;
    };
    reading_record: {
      location_id: string;
      value_c: number | string;
      measured_at: string;
      equipment: string;
      reason: string;
    };
    evaluate: { reason: string };
    resolve: { id: string; reason: string };
  };
  finance: {
    account_create: { name: string; kind: "cash" | "bank"; reason: string };
    title_create: {
      kind: "payable" | "receivable";
      description: string;
      amount: number | string;
      competence_on: string;
      due_on: string;
      source_type?: "receipt" | "production" | "order";
      source_id?: string;
      reason: string;
    };
    settle: {
      title_id: string;
      account_id: string;
      amount: number | string;
      paid_on: string;
      reason: string;
    };
    reverse: { settlement_id: string; reason: string };
    reconcile: {
      settlement_id: string;
      external_reference: string;
      reason: string;
    };
  };
  commercial: {
    customer_create: { name: string; user_id?: string; reason: string };
    catalog_save: {
      id?: string;
      variant_id: string;
      name: string;
      unit: "kg" | "g" | "l" | "un" | "pct" | "cx";
      price: number | string;
      active: boolean;
      reason: string;
    };
    order_create: {
      customer_id: string;
      items: { catalog_id: string; quantity: number | string }[];
      reason: string;
    };
    reserve: {
      order_id: string;
      allocations: {
        line_id: string;
        lot_id: string;
        quantity: number | string;
      }[];
      reason: string;
    };
    cancel: { order_id: string; reason: string };
    ship: { order_id: string; reason: string };
    return: {
      shipment_line_id: string;
      quantity: number | string;
      reason: string;
    };
  };
  time: {
    record: {
      kind: "start" | "pause" | "resume" | "end";
      occurred_at: string;
      notes: string;
    };
    correct: { entry_id: string; occurred_at: string; reason: string };
  };
};

export const snapshotLists: Record<OperationsModule, readonly string[]> = {
  inventory: ["counts", "count_lines", "lots", "locations", "movements"],
  receiving: ["templates", "inspections", "attachments", "receipts"],
  staff: ["members"],
  alerts: ["rules", "readings", "events", "locations"],
  finance: [
    "accounts",
    "titles",
    "settlements",
    "reconciliations",
    "receipts",
    "balances",
  ],
  commercial: [
    "customers",
    "catalog",
    "orders",
    "lines",
    "reservations",
    "shipments",
    "shipment_lines",
    "returns",
    "lots",
  ],
  time: ["entries"],
};

export type OperationsDatabaseFunctions = {
  operations_command: {
    Args: {
      p_command_id: string;
      p_module: string;
      p_action: string;
      p_data: Json;
    };
    Returns: Json;
  };
  operations_snapshot: { Args: { p_module: string }; Returns: Json };
};
