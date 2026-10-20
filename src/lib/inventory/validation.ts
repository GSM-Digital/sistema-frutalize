import {
  statuses,
  units,
  type CatalogEntity,
  type Json,
  type SearchParams,
} from "./types";
export class ValidationError extends Error {}
export function textField(
  data: FormData,
  key: string,
  label: string,
  min: number,
  max: number,
) {
  const raw = data.get(key);
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value.length < min || value.length > max)
    throw new ValidationError(
      `${label}: informe entre ${min} e ${max} caracteres.`,
    );
  return value;
}
export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export function uuidField(data: FormData, key: string) {
  const value = data.get(key);
  if (!isUuid(value)) throw new ValidationError("Selecione uma opção válida.");
  return value;
}
export function decimalField(
  data: FormData,
  key: string,
  decimals = 3,
  allowZero = false,
  optional = false,
) {
  const raw = textField(
    data,
    key,
    "Quantidade / valor",
    optional ? 0 : 1,
    24,
  ).replace(",", ".");
  if (optional && !raw) return null;
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(raw))
    throw new ValidationError(
      `Informe até ${decimals} casas decimais, sem separador de milhar.`,
    );
  const value = Number(raw);
  if (
    !Number.isFinite(value) ||
    value > 999999999 ||
    (allowZero ? value < 0 : value <= 0)
  )
    throw new ValidationError(
      "Quantidade ou valor fora do intervalo permitido.",
    );
  return value;
}
export function enumField<T extends string>(
  data: FormData,
  key: string,
  values: readonly T[],
): T {
  const value = data.get(key);
  if (typeof value !== "string" || !values.includes(value as T))
    throw new ValidationError("Selecione uma opção válida.");
  return value as T;
}
export function dateField(data: FormData, key: string, optional = false) {
  const value = textField(data, key, "Data", optional ? 0 : 10, 10);
  if (!value && optional) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1900)
    throw new ValidationError("Informe uma data válida.");
  const date = new Date(`${value}T12:00:00Z`);
  if (
    !Number.isFinite(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new ValidationError("Informe uma data válida.");
  return value;
}
export function businessDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function businessDateTime(now = new Date()) {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  return `${businessDate(now)}T${time}`;
}
export function operationalDateField(data: FormData, key: string) {
  const value = textField(data, key, "Data e hora", 16, 16);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new ValidationError("Informe data e hora válidas.");
  const dateData = new FormData();
  dateData.set("date", value.slice(0, 10));
  dateField(dateData, "date");
  if (Number(value.slice(11, 13)) > 23 || Number(value.slice(14)) > 59)
    throw new ValidationError("Horário inválido.");
  // Brasília's operational offset is UTC-3; the UI labels the timezone explicitly.
  const iso = `${value}:00-03:00`;
  if (new Date(iso).valueOf() > Date.now())
    throw new ValidationError("A data operacional não pode estar no futuro.");
  return iso;
}
export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function catalogInput(entity: CatalogEntity, data: FormData): Json {
  const values: Record<string, Json> = {
    name: textField(
      data,
      "name",
      "Nome",
      2,
      entity === "products" || entity === "suppliers" ? 120 : 80,
    ),
    active: data.get("active") === "true",
  };
  if (entity === "products") {
    values.category_id = uuidField(data, "category_id");
    values.requires_expiry = data.get("requires_expiry") === "true";
    values.has_variants = data.get("has_variants") === "true";
  }
  if (entity === "variants") {
    values.product_id = uuidField(data, "product_id");
    const sku = textField(data, "sku", "SKU", 1, 40).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(sku))
      throw new ValidationError(
        "SKU: use letras, números, ponto, traço ou sublinhado.",
      );
    values.sku = sku;
    values.unit_weight_kg = decimalField(
      data,
      "unit_weight_kg",
      6,
      false,
      true,
    );
    if (
      typeof values.unit_weight_kg === "number" &&
      values.unit_weight_kg > 999999
    )
      throw new ValidationError("Peso unitário acima do limite.");
  }
  if (entity === "locations")
    values.description = textField(data, "description", "Descrição", 0, 240);
  if (entity === "suppliers") {
    const cnpj = textField(data, "cnpj", "CNPJ", 0, 20)
      .replace(/[.\s/-]/g, "")
      .toUpperCase();
    if (cnpj && !/^[A-Z0-9]{12}\d{2}$/.test(cnpj))
      throw new ValidationError("Confira o formato do CNPJ (14 caracteres).");
    values.cnpj = cnpj;
    values.phone = textField(data, "phone", "Telefone", 0, 30);
    values.address = textField(data, "address", "Endereço", 0, 240);
    values.contact_name = textField(data, "contact_name", "Contato", 0, 120);
  }
  return values;
}
export function receiptInput(data: FormData) {
  const received = operationalDateField(data, "received_at");
  const manufactured = dateField(data, "manufactured_on", true);
  const expires = dateField(data, "expires_on", true);
  if (
    (expires &&
      (expires < businessDate() || expires < received.slice(0, 10))) ||
    (manufactured && manufactured > received.slice(0, 10))
  )
    throw new ValidationError("Confira fabricação, recebimento e validade.");
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
  const expiry_source = enumField(data, "expiry_source", [
    "supplier",
    "internal",
    "not_applicable",
  ] as const);
  if (!expires !== (expiry_source === "not_applicable"))
    throw new ValidationError(
      "Informe a validade e sua origem, ou marque não aplicável.",
    );
  return {
    p_request_id: uuidField(data, "request_id"),
    p_data: {
      variant_id: uuidField(data, "variant_id"),
      location_id: uuidField(data, "location_id"),
      supplier_id: uuidField(data, "supplier_id"),
      code: textField(data, "code", "Lote interno", 0, 80).toUpperCase(),
      supplier_lot: textField(
        data,
        "supplier_lot",
        "Lote do fornecedor",
        0,
        80,
      ),
      reference: textField(data, "reference", "Documento", 1, 80),
      received_at: received,
      manufactured_on: manufactured,
      expires_on: expires,
      expiry_source,
      unit,
      quantity,
      net_weight_kg: decimalField(data, "net_weight_kg", 6, false, true),
      total_cost: decimalField(data, "total_cost", 2, true)!,
      inspection_notes: textField(
        data,
        "inspection_notes",
        "Inspeção de qualidade",
        3,
        1000,
      ),
    },
  };
}

function objectText(
  value: Record<string, unknown>,
  key: string,
  label: string,
  min: number,
  max: number,
) {
  const raw = value[key];
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text.length < min || text.length > max)
    throw new ValidationError(
      `${label}: informe entre ${min} e ${max} caracteres.`,
    );
  return text;
}

function objectUuid(value: Record<string, unknown>, key: string) {
  const id = value[key];
  if (!isUuid(id)) throw new ValidationError("Selecione uma opção válida.");
  return id;
}

function objectDecimal(
  value: Record<string, unknown>,
  key: string,
  decimals = 3,
  allowZero = false,
  optional = false,
) {
  const rawValue = value[key];
  const raw =
    typeof rawValue === "string" || typeof rawValue === "number"
      ? String(rawValue).trim().replace(",", ".")
      : "";
  if (optional && !raw) return null;
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(raw))
    throw new ValidationError(
      `Informe até ${decimals} casas decimais, sem separador de milhar.`,
    );
  const parsed = Number(raw);
  if (
    !Number.isFinite(parsed) ||
    parsed > 999999999 ||
    (allowZero ? parsed < 0 : parsed <= 0)
  )
    throw new ValidationError(
      "Quantidade ou valor fora do intervalo permitido.",
    );
  return parsed;
}

function objectDate(
  value: Record<string, unknown>,
  key: string,
  optional = false,
) {
  const text = objectText(value, key, "Data", optional ? 0 : 10, 10);
  if (!text && optional) return null;
  const holder = new FormData();
  holder.set("date", text);
  return dateField(holder, "date");
}

export function deliveryInput(data: FormData) {
  const received = operationalDateField(data, "received_at");
  let rawItems: unknown;
  try {
    rawItems = JSON.parse(textField(data, "items", "Itens", 2, 100000));
  } catch {
    throw new ValidationError("Confira os itens deste recebimento.");
  }
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 50)
    throw new ValidationError("Informe de 1 a 50 itens por recebimento.");

  const items = rawItems.map((rawItem) => {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem))
      throw new ValidationError("Confira os itens deste recebimento.");
    const item = rawItem as Record<string, unknown>;
    const manufactured_on = objectDate(item, "manufactured_on", true);
    const expires_on = objectDate(item, "expires_on", true);
    if (
      (expires_on &&
        (expires_on < businessDate() || expires_on < received.slice(0, 10))) ||
      (manufactured_on && manufactured_on > received.slice(0, 10))
    )
      throw new ValidationError("Confira fabricação, recebimento e validade.");

    const unit = objectText(item, "unit", "Unidade", 1, 3);
    if (!Object.hasOwn(units, unit))
      throw new ValidationError("Selecione uma unidade válida.");
    const quantity = objectDecimal(item, "quantity")!;
    if (["un", "pct", "cx"].includes(unit) && !Number.isInteger(quantity))
      throw new ValidationError(
        "Unidades, pacotes e caixas exigem quantidade inteira.",
      );

    const expiry_source = objectText(
      item,
      "expiry_source",
      "Origem da validade",
      8,
      14,
    );
    if (!["supplier", "internal", "not_applicable"].includes(expiry_source))
      throw new ValidationError("Selecione a origem da validade.");
    if (!expires_on !== (expiry_source === "not_applicable"))
      throw new ValidationError(
        "Informe a validade e sua origem, ou marque não aplicável.",
      );

    return {
      variant_id: objectUuid(item, "variant_id"),
      location_id: objectUuid(item, "location_id"),
      code: objectText(item, "code", "Lote interno", 0, 80).toUpperCase(),
      supplier_lot: objectText(
        item,
        "supplier_lot",
        "Lote do fornecedor",
        0,
        80,
      ),
      manufactured_on,
      expires_on,
      expiry_source,
      unit,
      quantity,
      net_weight_kg: objectDecimal(item, "net_weight_kg", 6, false, true),
      total_cost: objectDecimal(item, "total_cost", 2, true)!,
      inspection_notes: objectText(
        item,
        "inspection_notes",
        "Inspeção de qualidade",
        3,
        1000,
      ),
    };
  });

  return {
    p_request_id: uuidField(data, "request_id"),
    p_data: {
      supplier_id: uuidField(data, "supplier_id"),
      reference: textField(
        data,
        "reference",
        "Nota fiscal ou referência",
        1,
        80,
      ),
      received_at: received,
      items,
    },
  };
}
export function statusInput(data: FormData) {
  return {
    p_request_id: uuidField(data, "request_id"),
    p_lot_id: uuidField(data, "lot_id"),
    p_status: enumField(
      data,
      "status",
      Object.keys(statuses) as (keyof typeof statuses)[],
    ),
    p_reason: textField(data, "reason", "Motivo", 3, 240),
  };
}
export function safeReturnPath(value: unknown) {
  return typeof value === "string" &&
    /^\/dashboard(?:\/[a-zA-Z0-9/-]*)?$/.test(value)
    ? value
    : "/dashboard";
}
export function listParams(params: SearchParams) {
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const pageValue =
    typeof params.pagina === "string" ? Number(params.pagina) : 1;
  const page =
    Number.isSafeInteger(pageValue) && pageValue > 0
      ? Math.min(pageValue, 100000)
      : 1;
  return {
    q,
    page,
    from: (page - 1) * 25,
    to: page * 25 - 1,
    pattern: `%${q.replace(/[\\%_]/g, "\\$&")}%`,
  };
}
