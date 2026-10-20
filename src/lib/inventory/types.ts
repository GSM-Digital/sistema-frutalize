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
export const statuses = {
  quarantine: "Em quarentena",
  released: "Liberado",
  blocked: "Bloqueado",
} as const;
export type LotStatus = keyof typeof statuses;
export const movementKinds = {
  receipt: "Recebimento",
  dispatch: "Saída",
  loss: "Perda / descarte",
  release: "Liberação",
  block: "Bloqueio",
  quarantine: "Quarentena",
} as const;
export type MovementKind = keyof typeof movementKinds;
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
  supplier_id: string;
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
  status: LotStatus;
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
  variant_name: string;
  sku: string;
  is_default: boolean;
  has_variants: boolean;
  location_name: string;
  supplier_name: string;
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
  quarantine_count: number;
  expiring_count: number;
  expired_count: number;
};
export type ActionState = {
  error?: string;
  success?: string;
  values?: Record<string, string>;
  catalogId?: string;
  catalogName?: string;
  lotId?: string;
  receiptId?: string;
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
      audit_events: Table<AuditEvent>;
    };
    Views: {
      inventory_variants: View<InventoryVariant>;
      inventory_lots: View<InventoryLot>;
      inventory_movements: View<InventoryMovement>;
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
          p_kind: "dispatch" | "loss";
          p_quantity: number;
          p_reason: string;
          p_operated_at: string;
        };
        Returns: string;
      };
      set_lot_status: {
        Args: {
          p_request_id: string;
          p_lot_id: string;
          p_status: LotStatus;
          p_reason: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
