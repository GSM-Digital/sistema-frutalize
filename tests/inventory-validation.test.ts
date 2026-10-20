import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  addDays,
  businessDate,
  businessDateTime,
  catalogInput,
  dateField,
  decimalField,
  listParams,
  operationalDateField,
  receiptInput,
  safeReturnPath,
  ValidationError,
} from "../src/lib/inventory/validation";
function data(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}
test("quantities support Brazilian decimal notation without ambiguous separators", () => {
  assert.equal(decimalField(data({ q: "12,125" }), "q"), 12.125);
  assert.equal(decimalField(data({ q: "0" }), "q", 2, true), 0);
  for (const value of [
    "0",
    "-1",
    "NaN",
    "1e2",
    "1.000,50",
    "1.2345",
    "Infinity",
    "1000000000",
  ])
    assert.throws(() => decimalField(data({ q: value }), "q"), ValidationError);
});
test("dates reject impossible calendar days and future operational timestamps", () => {
  for (const value of ["2026-02-29", "2026-13-01", "2026-04-31", "2026-01-1"])
    assert.throws(() => dateField(data({ d: value }), "d"), ValidationError);
  assert.equal(dateField(data({ d: "2024-02-29" }), "d"), "2024-02-29");
  assert.throws(
    () => operationalDateField(data({ d: "2100-01-01T00:00" }), "d"),
    ValidationError,
  );
  assert.throws(
    () => operationalDateField(data({ d: "2026-01-01T25:00" }), "d"),
    ValidationError,
  );
});
test("operational day follows Brasília across the UTC day boundary", () => {
  assert.equal(businessDate(new Date("2026-10-20T01:30:00Z")), "2026-10-19");
  assert.equal(
    businessDateTime(new Date("2026-10-20T01:30:00Z")),
    "2026-10-19T22:30",
  );
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
test("login return paths cannot redirect to another origin", () => {
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/dashboard/../../evil",
    "/dashboardevil",
    "/dashboard\\evil",
    "/dashboard?next=//evil.test",
  ])
    assert.equal(safeReturnPath(value), "/dashboard");
  assert.equal(safeReturnPath("/dashboard/lotes"), "/dashboard/lotes");
});
test("pagination and search are bounded and wildcard characters escaped", () => {
  assert.equal(listParams({ pagina: "-1" }).page, 1);
  assert.equal(listParams({ pagina: "Infinity" }).page, 1);
  assert.equal(listParams({ pagina: "1.5" }).page, 1);
  assert.equal(
    listParams({ q: "  a%b_c  ", pagina: "2" }).pattern,
    "%a\\%b\\_c%",
  );
  assert.equal(listParams({ pagina: "2" }).from, 25);
});
test("catalog separates products from presentations and checks SKU/optional weight", () => {
  const product = catalogInput(
    "products",
    data({
      name: "Polpa de morango",
      category_id: randomUUID(),
      requires_expiry: "true",
      active: "true",
    }),
  );
  assert.equal((product as { requires_expiry: boolean }).requires_expiry, true);
  assert.throws(
    () =>
      catalogInput(
        "variants",
        data({
          name: "500 g",
          product_id: randomUUID(),
          sku: "bad sku",
          unit_weight_kg: "0,5",
        }),
      ),
    ValidationError,
  );
});
test("receipt captures quantity, unit and weight independently without estimating conversions", () => {
  const values = {
    request_id: randomUUID(),
    variant_id: randomUUID(),
    location_id: randomUUID(),
    supplier_id: randomUUID(),
    code: "",
    supplier_lot: "",
    reference: "NF-1",
    received_at: businessDateTime(new Date(Date.now() - 60000)),
    manufactured_on: "",
    expires_on: addDays(businessDate(), 30),
    expiry_source: "supplier",
    unit: "un",
    quantity: "3",
    net_weight_kg: "1,25",
    total_cost: "12,50",
    inspection_notes: "Conferência realizada",
  };
  const result = receiptInput(data(values));
  assert.equal(result.p_data.quantity, 3);
  assert.equal(result.p_data.net_weight_kg, 1.25);
  assert.equal(result.p_data.total_cost, 12.5);
  assert.equal(
    receiptInput(data({ ...values, net_weight_kg: "" })).p_data.net_weight_kg,
    null,
  );
  assert.throws(
    () => receiptInput(data({ ...values, quantity: "1,5" })),
    ValidationError,
  );
  assert.throws(
    () =>
      receiptInput(
        data({ ...values, expires_on: "", expiry_source: "supplier" }),
      ),
    ValidationError,
  );
});
