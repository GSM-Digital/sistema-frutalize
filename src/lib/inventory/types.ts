export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export const units = {
  kg: "Quilograma (kg)",
  g: "Grama (g)",
  l: "Litro (l)",
  un: "Unidade (un)",
  pct: "Pacote (pct)",
  cx: "Caixa (cx)",
} as const;
export type Unit = keyof typeof units;
export const movementKinds = {
  receipt: "Recebimento",
  dispatch: "Saída anterior",
  external_dispatch: "Saída externa",
  loss: "Perda / descarte",
  production_input: "Envio à produção",
  production_output: "Produção finalizada",
  note: "Registro histórico",
} as const;
export type MovementKind = keyof typeof movementKinds;
export const lotOperations = {
  production: "Enviar para produção",
  external_dispatch: "Registrar saída externa",
  loss: "Registrar perda / descarte",
} as const;
export type LotOperation = keyof typeof lotOperations;
export const externalDestinations = {
  supplier_return: "Devolução ao fornecedor",
  donation: "Doação",
  internal_use: "Uso interno",
  other: "Outra saída",
} as const;
type BaseCatalog = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
};
export type Category = BaseCatalog;
export type Product = BaseCatalog & {
  category_id: string;
  requires_expiry: boolean;
  has_variants: boolean;
};
export type Variant = BaseCatalog & {
  product_id: string;
  sku: string;
  unit_weight_kg: number | null;
  is_default: boolean;
};
export type Supplier = BaseCatalog & {
  cnpj: string;
  phone: string;
  address: string;
  contact_name: string;
};
export type Location = BaseCatalog & { description: string };
export type InventoryVariant = Variant & {
  product_name: string;
  requires_expiry: boolean;
  has_variants: boolean;
  product_active: boolean;
  category_name: string;
  category_active: boolean;
  search_text: string;
};
export type Lot = {
  id: string;
  receipt_id: string | null;
  code: string;
  variant_id: string;
  location_id: string;
  supplier_id: string | null;
  production_run_id: string | null;
  supplier_lot: string;
  reference: string;
  received_at: string;
  manufactured_on: string | null;
  expires_on: string | null;
  expiry_source: "supplier" | "internal" | "not_applicable";
  unit: Unit;
  initial_quantity: number;
  initial_weight_kg: number | null;
  total_cost: number;
  unit_cost: number;
  quantity: number;
  inspection_notes: string;
  created_by: string;
  created_at: string;
};
export type Movement = {
  id: string;
  request_id: string;
  lot_id: string;
  kind: MovementKind;
  quantity: number;
  balance_after: number;
  reason: string;
  operated_at: string;
  created_by: string;
  actor_name: string;
  created_at: string;
};
export type AuditEvent = {
  id: string;
  entity: string;
  record_id: string;
  action: string;
  before_data: Json;
  after_data: Json;
  reason: string;
  created_by: string | null;
  actor_name: string;
  created_at: string;
};
export type InventoryLot = Lot & {
  product_name: string;
  category_name: string;
  variant_name: string;
  sku: string;
  is_default: boolean;
  has_variants: boolean;
  location_name: string;
  supplier_name: string;
  origin: "supplier" | "production";
  remaining_weight_kg: number | null;
  search_text: string;
};
export type InventoryMovement = Movement & {
  lot_code: string;
  product_name: string;
  variant_name: string;
  sku: string;
  is_default: boolean;
  has_variants: boolean;
  unit: Unit;
  location_name: string;
  search_text: string;
};
export type Overview = {
  products_count: number;
  lots_count: number;
  expiring_count: number;
  expired_count: number;
};
export type ProductionStatus = "in_progress" | "completed";
export type ProductionRun = {
  id: string;
  request_id: string;
  completion_request_id: string | null;
  code: string;
  status: ProductionStatus;
  started_at: string;
  completed_at: string | null;
  output_lot_id: string | null;
  created_by: string;
  completed_by: string | null;
  created_at: string;
};
export type InventoryProductionRun = ProductionRun & {
  input_count: number;
  total_input_cost: number;
  input_summary: string;
  output_lot_code: string | null;
  output_quantity: number | null;
  output_unit: Unit | null;
  output_product_name: string | null;
  output_variant_name: string | null;
  output_is_default: boolean | null;
  output_location_name: string | null;
};
export type ProductionInput = {
  id: string;
  production_run_id: string;
  source_lot_id: string;
  movement_id: string;
  quantity: number;
  unit: Unit;
  input_cost: number;
  created_at: string;
};
export type InventoryProductionInput = ProductionInput & {
  source_lot_code: string;
  product_name: string;
  variant_name: string;
  sku: string;
  is_default: boolean;
  source_location_name: string;
};
export type ActionState = {
  error?: string;
  success?: string;
  values?: Record<string, string>;
  catalogId?: string;
  catalogName?: string;
  lotId?: string;
  receiptId?: string;
  productionId?: string;
  successId?: string;
};
export type SearchParams = Record<string, string | string[] | undefined>;
export type CatalogEntity =
  "products" | "variants" | "suppliers" | "locations" | "categories";
export type CatalogRecord = {
  id: string;
  name: string;
  active: boolean;
  [key: string]: Json | undefined;
};
export type CatalogOptions = {
  categories: Category[];
  products: Product[];
  variants: InventoryVariant[];
  suppliers: Supplier[];
  locations: Location[];
};
type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};
type View<Row> = { Row: Row; Relationships: [] };
export type Database = {
  public: {
    Tables: {
      staff_members: Table<{
        user_id: string;
        display_name: string;
        role: "admin" | "manager" | "collaborator";
        active: boolean;
        created_at: string;
      }>;
      categories: Table<Category>;
      products: Table<Product>;
      item_variants: Table<Variant>;
      suppliers: Table<Supplier>;
      storage_locations: Table<Location>;
      receipts: Table<{
        id: string;
        request_id: string;
        supplier_id: string;
        reference: string;
        received_at: string;
        item_count: number;
        total_cost: number;
        created_by: string;
        created_at: string;
      }>;
      lots: Table<Lot>;
      stock_movements: Table<Movement>;
      production_runs: Table<ProductionRun>;
      production_inputs: Table<ProductionInput>;
      audit_events: Table<AuditEvent>;
    };
    Views: {
      inventory_variants: View<InventoryVariant>;
      inventory_lots: View<InventoryLot>;
      inventory_movements: View<InventoryMovement>;
      inventory_production_runs: View<InventoryProductionRun>;
      inventory_production_inputs: View<InventoryProductionInput>;
    };
    Functions: {
      can_manage_inventory: { Args: Record<string, never>; Returns: boolean };
      inventory_overview: { Args: Record<string, never>; Returns: Overview[] };
      save_catalog: {
        Args: {
          p_entity: CatalogEntity;
          p_id: string | null;
          p_values: Json;
          p_reason: string;
        };
        Returns: string;
      };
      receive_lot: {
        Args: { p_request_id: string; p_data: Json };
        Returns: string;
      };
      receive_delivery: {
        Args: { p_request_id: string; p_data: Json };
        Returns: string;
      };
      move_stock: {
        Args: {
          p_request_id: string;
          p_lot_id: string;
          p_kind: "external_dispatch" | "loss";
          p_quantity: number;
          p_reason: string;
          p_operated_at: string;
        };
        Returns: string;
      };
      start_production: {
        Args: {
          p_request_id: string;
          p_lot_id: string;
          p_quantity: number;
          p_operated_at: string;
        };
        Returns: string;
      };
      complete_production: {
        Args: {
          p_request_id: string;
          p_production_id: string;
          p_data: Json;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
