import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("inventory migration and database authorization", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const admin = randomUUID(),
    outsider = randomUUID(),
    manager = randomUUID(),
    collaborator = randomUUID();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function extensions.gen_salt(text, integer default 6) returns text language sql volatile as $$ select 'test$' || md5(random()::text) $$;
    create function extensions.crypt(value text, salt text) returns text language sql immutable as $$
      select base || '$' || md5(value || base)
      from (
        select case
          when salt ~ '^test\\$[^$]+\\$' then regexp_replace(salt, '\\$[^$]+$', '')
          else salt
        end as base
      ) parsed
    $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;`);
  for (const file of [
    "202610200001_inventory.sql",
    "202610200002_bootstrap_admin.sql",
    "202610200003_harden_inventory_rpcs.sql",
    "202610200004_simplify_receiving.sql",
    "20261020221100_remove_lot_status_workflow.sql",
    "20261020223216_add_production_flow.sql",
    "20261021025215_terminal_touch_workflow.sql",
    "20261021030453_expose_terminal_workflow_in_production_view.sql",
    "20261021032108_production_operator_pin.sql",
  ]) {
    let migration = await readFile(
      new URL(`../supabase/migrations/${file}`, import.meta.url),
      "utf8",
    );
    // PGlite does not bundle pgcrypto. The test-only compatible functions above
    // preserve the hashing contract while production installs the real extension.
    migration = migration.replace(
      "create extension if not exists pgcrypto with schema extensions;",
      "",
    );
    await db.exec(migration);
  }
  const bootstrap = await db.query<{ count: number }>(
    "select count(*)::int as count from staff_members",
  );
  assert.equal(
    bootstrap.rows[0].count,
    0,
    "a clean migration replay must not create an environment-specific admin",
  );
  await db.query("insert into auth.users(id) values ($1),($2),($3),($4)", [
    admin,
    outsider,
    manager,
    collaborator,
  ]);
  await db.query(
    "insert into staff_members(user_id,display_name,role) values ($1,'Admin Teste','admin'),($2,'Gestor Teste','manager'),($3,'Colaborador Teste','collaborator')",
    [admin, manager, collaborator],
  );
  async function user(id: string) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  }
  async function scalar(sql: string, args: unknown[] = []) {
    const { rows } = await db.query<Record<string, unknown>>(sql, args);
    return Object.values(rows[0])[0] as string;
  }
  const save = (
    entity: string,
    id: string | null,
    data: unknown,
    reason = "Cadastro de teste",
  ) =>
    scalar("select save_catalog($1,$2,$3,$4)", [
      entity,
      id,
      JSON.stringify(data),
      reason,
    ]);
  await user(admin);
  const category = await scalar(
    "select id from categories where name = 'Frutas recebidas'",
  );
  const location = await scalar(
    "select id from storage_locations where name = 'Freezer 1'",
  );
  let product: string, variant: string, supplier: string, lot: string;
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const receipt = (
    overrides: Record<string, unknown> = {},
    requestId = randomUUID(),
  ) =>
    scalar("select receive_lot($1,$2)", [
      requestId,
      JSON.stringify({
        variant_id: variant,
        location_id: location,
        supplier_id: supplier,
        reference: "NF-001",
        received_at: yesterday,
        expires_on: tomorrow,
        expiry_source: "supplier",
        unit: "un",
        quantity: 10,
        total_cost: 25,
        inspection_notes: "Conferência de teste",
        ...overrides,
      }),
    ]);
  const move = (
    kind: string,
    qty: number,
    reason = kind === "loss" ? "Deterioração" : "Devolução ao fornecedor",
    requestId = randomUUID(),
    date = new Date().toISOString(),
  ) =>
    scalar("select move_stock($1,$2,$3,$4,$5,$6)", [
      requestId,
      lot,
      kind,
      qty,
      reason,
      date,
    ]);

  await t.test(
    "seeds confirmed categories and archives non-stock process locations",
    async () => {
      assert.equal(Number(await scalar("select count(*) from categories")), 9);
      assert.equal(
        Number(await scalar("select count(*) from storage_locations")),
        7,
      );
      assert.equal(
        Number(
          await scalar(
            "select count(*) from storage_locations where active = true",
          ),
        ),
        5,
      );
      assert.equal(
        await scalar(
          "select active::text from storage_locations where name = 'Quarentena'",
        ),
        "false",
      );
      assert.equal(
        await scalar(
          "select active::text from storage_locations where name = 'Produção'",
        ),
        "false",
      );
      assert.equal(Number(await scalar("select count(*) from lots")), 0);
      assert.equal(
        await scalar(
          "select to_regprocedure('public.set_lot_status(uuid,uuid,text,text)') is null",
        ),
        true,
      );
    },
  );
  await t.test(
    "anonymous, unapproved and future roles cannot access inventory",
    async () => {
      await db.exec("set role anon");
      await assert.rejects(db.query("select * from lots"), /permission denied/);
      await assert.rejects(
        db.query("select inventory_overview()"),
        /permission denied/,
      );
      for (const id of [outsider, manager, collaborator]) {
        await user(id);
        assert.equal(
          Number(await scalar("select count(*) from categories")),
          0,
        );
        await assert.rejects(
          save("categories", null, { name: "Forbidden" }),
          /Acesso não autorizado/,
        );
        await assert.rejects(
          db.query("select receive_lot($1,'{}')", [randomUUID()]),
          /Acesso não autorizado/,
        );
        await assert.rejects(
          db.query("select start_production($1,$2,$3,$4)", [
            randomUUID(),
            randomUUID(),
            1,
            new Date().toISOString(),
          ]),
          /Acesso não autorizado/,
        );
        await assert.rejects(
          db.query("select complete_production($1,$2,$3)", [
            randomUUID(),
            randomUUID(),
            "{}",
          ]),
          /Acesso não autorizado/,
        );
        await assert.rejects(
          db.query(
            "select save_production_progress($1,$2::smallint,$3::smallint,$4::jsonb)",
            [randomUUID(), 1, 1, "{}"],
          ),
          /Acesso não autorizado/,
        );
        await assert.rejects(
          db.query("select set_own_production_pin('1234')"),
          /Acesso não autorizado/,
        );
        await assert.rejects(
          db.query("select claim_production_run($1,'1234')", [randomUUID()]),
          /Acesso não autorizado/,
        );
      }
      await user(admin);
    },
  );
  await t.test(
    "catalog changes are audited, with exact before/after and actor",
    async () => {
      product = await save("products", null, {
        name: "Polpa de maracujá",
        category_id: category,
        requires_expiry: true,
        has_variants: true,
      });
      variant = await save("variants", null, {
        name: "500 g",
        product_id: product,
        sku: "MAR-500",
        unit_weight_kg: 0.5,
      });
      supplier = await save("suppliers", null, {
        name: "Fornecedor Teste",
        cnpj: "",
        phone: "",
        address: "",
        contact_name: "",
      });
      await save(
        "products",
        product,
        { name: "Polpa de maracujá revisada" },
        "Correção do nome",
      );
      const { rows } = await db.query<{
        before_data: { name: string };
        after_data: { name: string };
        actor_name: string;
      }>(
        "select * from audit_events where record_id = $1 and action = 'UPDATE'",
        [product],
      );
      assert.equal(rows[0].before_data.name, "Polpa de maracujá");
      assert.equal(rows[0].after_data.name, "Polpa de maracujá revisada");
      assert.equal(rows[0].actor_name, "Admin Teste");
    },
  );
  await t.test(
    "common items receive directly and one delivery commits all items atomically",
    async () => {
      const commonProduct = await save("products", null, {
        name: "Maracujá in natura",
        category_id: category,
        requires_expiry: false,
        has_variants: false,
      });
      const commonVariant = await scalar(
        "select id from item_variants where product_id = $1 and is_default",
        [commonProduct],
      );
      assert.equal(
        await scalar("select name from item_variants where id = $1", [
          commonVariant,
        ]),
        "Padrão",
      );

      const requestId = randomUUID();
      const deliveryData = JSON.stringify({
        supplier_id: supplier,
        reference: "NF-ENTREGA-002",
        received_at: yesterday,
        items: [
          {
            variant_id: commonVariant,
            location_id: location,
            code: "",
            supplier_lot: "FORN-01",
            manufactured_on: "",
            expires_on: "",
            expiry_source: "not_applicable",
            unit: "un",
            quantity: 10,
            net_weight_kg: 3.2,
            total_cost: 20,
            inspection_notes: "Frutas recebidas sem avarias aparentes.",
          },
          {
            variant_id: commonVariant,
            location_id: location,
            code: "",
            supplier_lot: "FORN-02",
            manufactured_on: "",
            expires_on: "",
            expiry_source: "not_applicable",
            unit: "kg",
            quantity: 5,
            net_weight_kg: "",
            total_cost: 15,
            inspection_notes: "Frutas recebidas e pesadas na entrada.",
          },
        ],
      });
      const deliveryId = await scalar("select receive_delivery($1,$2)", [
        requestId,
        deliveryData,
      ]);
      assert.equal(
        await scalar("select receive_delivery($1,$2)", [
          requestId,
          deliveryData,
        ]),
        deliveryId,
      );
      const { rows } = await db.query<{
        item_count: number;
        total_cost: string;
      }>("select item_count,total_cost from receipts where id = $1", [
        deliveryId,
      ]);
      assert.equal(rows[0].item_count, 2);
      assert.equal(Number(rows[0].total_cost), 35);
      assert.equal(
        Number(
          await scalar("select count(*) from lots where receipt_id = $1", [
            deliveryId,
          ]),
        ),
        2,
      );
      assert.equal(
        Number(
          await scalar(
            "select count(*) from stock_movements m join lots l on l.id = m.lot_id where l.receipt_id = $1",
            [deliveryId],
          ),
        ),
        2,
      );

      const failedRequest = randomUUID();
      const invalid = JSON.parse(deliveryData);
      invalid.items[1].quantity = -1;
      await assert.rejects(
        db.query("select receive_delivery($1,$2)", [
          failedRequest,
          JSON.stringify(invalid),
        ]),
        /Quantidade ou unidade inválida/,
      );
      assert.equal(
        Number(
          await scalar("select count(*) from receipts where request_id = $1", [
            failedRequest,
          ]),
        ),
        0,
      );
    },
  );
  await t.test(
    "all direct writes and self privilege escalation are denied",
    async () => {
      for (const table of [
        "products",
        "lots",
        "stock_movements",
        "production_runs",
        "production_inputs",
        "audit_events",
        "staff_members",
      ]) {
        await assert.rejects(
          db.query(`delete from ${table}`),
          /permission denied/,
        );
      }
      await assert.rejects(
        db.query("update staff_members set role = 'admin'"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("update lots set quantity = 100"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("insert into categories(name) values('Bypass')"),
        /permission denied/,
      );
    },
  );
  await t.test(
    "receiving is atomic, immediately available and idempotent with computed cost/weight",
    async () => {
      const requestId = randomUUID();
      lot = await receipt({}, requestId);
      assert.equal(await receipt({}, requestId), lot);
      const { rows } = await db.query<{
        quantity: string;
        initial_weight_kg: string;
        unit_cost: string;
      }>("select * from lots where id = $1", [lot]);
      assert.equal(Number(rows[0].quantity), 10);
      assert.equal(Number(rows[0].initial_weight_kg), 5);
      assert.equal(Number(rows[0].unit_cost), 2.5);
      assert.equal(
        Number(
          await scalar(
            "select count(*) from stock_movements where lot_id = $1",
            [lot],
          ),
        ),
        1,
      );
    },
  );
  await t.test("failed writes roll back both balance and ledger", async () => {
    await assert.rejects(move("external_dispatch", 1, ""), /destino válido/);
    assert.equal(
      Number(await scalar("select quantity from lots where id = $1", [lot])),
      10,
    );
    await assert.rejects(
      receipt({ code: "bad-receipt", reference: "" }),
      /check constraint/,
    );
    assert.equal(
      Number(
        await scalar("select count(*) from lots where code = 'bad-receipt'"),
      ),
      0,
    );
  });
  await t.test(
    "external dispatch is immediately available and retries leave one audit trail",
    async () => {
      const requestId = randomUUID();
      const movement = await move(
        "external_dispatch",
        3,
        "Devolução ao fornecedor",
        requestId,
      );
      assert.equal(
        await move(
          "external_dispatch",
          3,
          "Devolução ao fornecedor",
          requestId,
        ),
        movement,
      );
      assert.equal(
        Number(await scalar("select quantity from lots where id = $1", [lot])),
        7,
      );
      assert.equal(
        Number(
          await scalar(
            "select sum(quantity) from stock_movements where lot_id = $1",
            [lot],
          ),
        ),
        7,
      );
    },
  );
  await t.test(
    "no negative stock, fractional count units or forged operation types",
    async () => {
      await assert.rejects(move("external_dispatch", 8), /Saldo insuficiente/);
      await assert.rejects(
        move("external_dispatch", 0.5),
        /Quantidade inválida/,
      );
      await assert.rejects(move("invented", 1), /Tipo de movimentação/);
      await assert.rejects(move("loss", -1), /Quantidade inválida/);
      await assert.rejects(
        move("loss", 1, "Deterioração", randomUUID(), "2100-01-01T00:00:00Z"),
        /Data operacional/,
      );
      await assert.rejects(
        move("loss", 1, "Deterioração", randomUUID(), "2000-01-01T00:00:00Z"),
        /Data operacional/,
      );
    },
  );
  await t.test(
    "competing stock requests cannot overspend the balance",
    async () => {
      const results = await Promise.allSettled([
        move("external_dispatch", 5),
        move("external_dispatch", 5),
      ]);
      assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
      assert.equal(
        Number(await scalar("select quantity from lots where id = $1", [lot])),
        2,
      );
    },
  );
  await t.test(
    "loss receives its automatic classification and expired lots cannot dispatch",
    async () => {
      await move("loss", 1, "Avaria");
      assert.equal(
        await scalar(
          "select reason from stock_movements where lot_id = $1 order by created_at desc, id desc limit 1",
          [lot],
        ),
        "Perda operacional",
      );
      // Advance this fixture into the past through the trusted database owner.
      await db.exec("reset role");
      await db.query(
        "update lots set received_at = now() - interval '5 days', expires_on = (now() at time zone 'America/Sao_Paulo')::date - 1 where id = $1",
        [lot],
      );
      await user(admin);
      await assert.rejects(move("external_dispatch", 1), /vencidos/);
      await move("loss", 1, "Produto vencido");
      assert.equal(
        await scalar(
          "select reason from stock_movements where lot_id = $1 order by created_at desc, id desc limit 1",
          [lot],
        ),
        "Produto vencido",
      );
      assert.equal(
        Number(await scalar("select quantity from lots where id = $1", [lot])),
        0,
      );
    },
  );
  await t.test(
    "unit/presentation weight never invents a box conversion",
    async () => {
      const box = await receipt({
        unit: "cx",
        quantity: 2,
        net_weight_kg: null,
      });
      assert.equal(
        await scalar("select initial_weight_kg from lots where id = $1", [box]),
        null,
      );
      const mass = await receipt({ unit: "g", quantity: 500 });
      assert.equal(
        Number(
          await scalar("select initial_weight_kg from lots where id = $1", [
            mass,
          ]),
        ),
        0.5,
      );
      const fruitVariant = await save("variants", null, {
        name: "Sem peso padrão",
        product_id: product,
        sku: "FRUTA-UN",
        unit_weight_kg: null,
      });
      const unweighed = await receipt({
        variant_id: fruitVariant,
        unit: "un",
        quantity: 3,
      });
      assert.equal(
        await scalar("select initial_weight_kg from lots where id = $1", [
          unweighed,
        ]),
        null,
      );
      const weighed = await receipt({
        variant_id: fruitVariant,
        unit: "un",
        quantity: 3,
        net_weight_kg: 1.25,
      });
      assert.equal(
        Number(
          await scalar("select initial_weight_kg from lots where id = $1", [
            weighed,
          ]),
        ),
        1.25,
      );
    },
  );
  await t.test(
    "required expiry, dates and numeric precision are enforced by the database",
    async () => {
      await assert.rejects(
        receipt({ expires_on: null, expiry_source: "not_applicable" }),
        /validade/,
      );
      await assert.rejects(
        receipt({ quantity: 1.0001, unit: "kg" }),
        /Quantidade/,
      );
      await assert.rejects(receipt({ total_cost: 1.001 }), /Preço/);
      await assert.rejects(
        receipt({ unit: "un", quantity: 1.5 }),
        /Quantidade/,
      );
      await assert.rejects(
        receipt({ received_at: "2100-01-01T00:00:00Z" }),
        /datas/,
      );
      await assert.rejects(
        receipt({ manufactured_on: "2100-01-01" }),
        /check constraint/,
      );
      const nonperishable = await save("products", null, {
        name: "Caixa de transporte",
        category_id: category,
        requires_expiry: false,
        has_variants: true,
      });
      const nonperishableVariant = await save("variants", null, {
        name: "Padrão",
        product_id: nonperishable,
        sku: "CX-001",
        unit_weight_kg: null,
      });
      const withoutExpiry = await receipt({
        variant_id: nonperishableVariant,
        expires_on: null,
        expiry_source: "not_applicable",
        unit: "un",
      });
      assert.equal(
        await scalar("select expires_on from lots where id = $1", [
          withoutExpiry,
        ]),
        null,
      );
    },
  );
  await t.test(
    "production consumes a source lot and creates a traceable frozen output",
    async () => {
      const sourceLot = await receipt();
      const startedAt = new Date().toISOString();
      const startRequest = randomUUID();
      const productionId = await scalar(
        "select start_production($1,$2,$3,$4)",
        [startRequest, sourceLot, 4, startedAt],
      );
      assert.equal(
        await scalar(
          "select workflow_phase::text || ':' || workflow_step::text from production_runs where id = $1",
          [productionId],
        ),
        "1:1",
      );
      assert.equal(
        await scalar(
          "select workflow_phase::text || ':' || workflow_step::text from inventory_production_runs where id = $1",
          [productionId],
        ),
        "1:1",
      );
      await db.query("select set_own_production_pin('1234')");
      await assert.rejects(
        db.query(
          "select production_pin_hash from staff_members where user_id = $1",
          [admin],
        ),
        /permission denied/,
      );
      await db.exec("reset role");
      const storedPin = await scalar(
        "select production_pin_hash from staff_members where user_id = $1",
        [admin],
      );
      assert.notEqual(storedPin, "1234");
      assert.match(String(storedPin), /^test\$/);
      await user(admin);
      const invalidClaim = await db.query<{ error_code: string }>(
        "select error_code from claim_production_run($1,'9999')",
        [productionId],
      );
      assert.equal(invalidClaim.rows[0].error_code, "invalid");
      const claimed = await db.query<{
        operator_id: string;
        operator_name: string;
        responsibility_started_at: string;
        error_code: string | null;
      }>("select * from claim_production_run($1,'1234')", [productionId]);
      assert.equal(claimed.rows[0].operator_id, admin);
      assert.equal(claimed.rows[0].operator_name, "Admin Teste");
      assert.equal(claimed.rows[0].error_code, null);
      const responsibleData = {
        responsibleOperatorId: claimed.rows[0].operator_id,
        responsibleOperatorName: claimed.rows[0].operator_name,
        responsibilityStartedAt: claimed.rows[0].responsibility_started_at,
        packageSizeG: 100,
        testPackageConfirmedAt: new Date().toISOString(),
      };
      await db.query(
        "select save_production_progress($1,$2::smallint,$3::smallint,$4::jsonb)",
        [productionId, 4, 2, JSON.stringify(responsibleData)],
      );
      assert.equal(
        await scalar(
          "select workflow_phase::text || ':' || workflow_step::text from production_runs where id = $1",
          [productionId],
        ),
        "4:2",
      );
      assert.equal(
        await scalar(
          "select workflow_data->>'responsibleOperatorName' from production_runs where id = $1",
          [productionId],
        ),
        "Admin Teste",
      );
      await assert.rejects(
        db.query(
          "select save_production_progress($1,$2::smallint,$3::smallint,$4::jsonb)",
          [productionId, 7, 1, JSON.stringify(responsibleData)],
        ),
        /Fase de produção inválida/,
      );
      assert.equal(
        await scalar("select start_production($1,$2,$3,$4)", [
          startRequest,
          sourceLot,
          4,
          startedAt,
        ]),
        productionId,
      );
      assert.equal(
        Number(
          await scalar("select quantity from lots where id = $1", [sourceLot]),
        ),
        6,
      );
      assert.equal(
        await scalar("select kind from stock_movements where request_id = $1", [
          startRequest,
        ]),
        "production_input",
      );

      const pulpCategory = await scalar(
        "select id from categories where name = 'Polpas prontas'",
      );
      const pulpProduct = await save("products", null, {
        name: "Polpa rastreável de maracujá",
        category_id: pulpCategory,
        requires_expiry: true,
        has_variants: true,
      });
      const pulpVariant = await save("variants", null, {
        name: "500 g",
        product_id: pulpProduct,
        sku: "POLPA-MAR-500",
        unit_weight_kg: 0.5,
      });
      const freezer = await scalar(
        "select id from storage_locations where name = 'Freezer 1'",
      );
      const completedAt = new Date().toISOString();
      const completionRequest = randomUUID();
      const outputData = JSON.stringify({
        variant_id: pulpVariant,
        location_id: freezer,
        quantity: 8,
        unit: "un",
        net_weight_kg: "",
        completed_at: completedAt,
        expires_on: tomorrow,
        notes: "Produção de teste concluída.",
      });
      const outputLot = await scalar("select complete_production($1,$2,$3)", [
        completionRequest,
        productionId,
        outputData,
      ]);
      assert.equal(
        await scalar("select complete_production($1,$2,$3)", [
          completionRequest,
          productionId,
          outputData,
        ]),
        outputLot,
      );
      const { rows } = await db.query<{
        production_run_id: string;
        supplier_id: string | null;
        quantity: string;
        initial_weight_kg: string;
        total_cost: string;
      }>("select * from lots where id = $1", [outputLot]);
      assert.equal(rows[0].production_run_id, productionId);
      assert.equal(rows[0].supplier_id, null);
      assert.equal(Number(rows[0].quantity), 8);
      assert.equal(Number(rows[0].initial_weight_kg), 4);
      assert.equal(Number(rows[0].total_cost), 10);
      assert.equal(
        await scalar("select status from production_runs where id = $1", [
          productionId,
        ]),
        "completed",
      );
      await assert.rejects(
        db.query(
          "select save_production_progress($1,$2::smallint,$3::smallint,$4::jsonb)",
          [productionId, 6, 1, JSON.stringify(responsibleData)],
        ),
        /já foi finalizada/,
      );
      assert.equal(
        await scalar("select origin from inventory_lots where id = $1", [
          outputLot,
        ]),
        "production",
      );
      await assert.rejects(
        db.query("select start_production($1,$2,$3,$4)", [
          randomUUID(),
          outputLot,
          1,
          new Date().toISOString(),
        ]),
        /Somente frutas recebidas/,
      );
      await assert.rejects(
        db.query("select complete_production($1,$2,$3)", [
          randomUUID(),
          productionId,
          outputData,
        ]),
        /já foi finalizada/,
      );
    },
  );
  await t.test(
    "archive prevents new receipts and preserves old lots",
    async () => {
      await save(
        "suppliers",
        supplier,
        { active: false },
        "Fornecedor arquivado",
      );
      await assert.rejects(receipt(), /Fornecedor indisponível/);
      assert.ok(
        Number(await scalar("select count(*) from inventory_lots")) > 0,
      );
      await save(
        "suppliers",
        supplier,
        { active: true },
        "Fornecedor reativado",
      );
    },
  );
  await t.test(
    "revoking membership denies RPC and security-invoker views immediately",
    async () => {
      await db.exec("reset role");
      await db.query(
        "update staff_members set active = false where user_id = $1",
        [admin],
      );
      await user(admin);
      await assert.rejects(receipt(), /Acesso não autorizado/);
      for (const view of [
        "inventory_variants",
        "inventory_lots",
        "inventory_movements",
        "inventory_production_runs",
        "inventory_production_inputs",
      ])
        assert.equal(Number(await scalar(`select count(*) from ${view}`)), 0);
    },
  );
});
