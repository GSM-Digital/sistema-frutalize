import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("operations: migration replay, atomic business rules and authorization", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function extensions.gen_salt(text,integer default 6) returns text language sql volatile as $$ select 'test$'||md5(random()::text) $$;
    create function extensions.crypt(value text,salt text) returns text language sql immutable as $$ select salt||'$'||md5(value||salt) $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;`);
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(migrations))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    const sql = (await readFile(new URL(file, migrations), "utf8")).replace(
      "create extension if not exists pgcrypto with schema extensions;",
      "",
    );
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Migration ${file}: ${String(error)}`, { cause: error });
    }
  }
  const [
    admin,
    approver,
    manager,
    collaborator,
    outsider,
    customerUser,
    otherCustomerUser,
  ] = Array.from({ length: 7 }, () => randomUUID());
  await db.query("insert into auth.users select unnest($1::uuid[])", [
    [
      admin,
      approver,
      manager,
      collaborator,
      outsider,
      customerUser,
      otherCustomerUser,
    ],
  ]);
  await db.query(
    `insert into staff_members(user_id,display_name,role) values
    ($1,'Admin Teste','admin'),($2,'Aprovador Teste','admin'),($3,'Gestor Teste','manager'),($4,'Colaborador Teste','collaborator')`,
    [admin, approver, manager, collaborator],
  );
  async function user(id: string | null) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      id ?? "",
    ]);
    await db.exec(`set role ${id ? "authenticated" : "anon"}`);
  }
  async function scalar<T = string>(
    sql: string,
    args: unknown[] = [],
  ): Promise<T> {
    const result = await db.query<Record<string, T>>(sql, args);
    return Object.values(result.rows[0])[0];
  }
  type Snapshot = Record<string, Record<string, unknown>[]>;
  const snapshot = (module: string) =>
    scalar<Snapshot>("select operations_snapshot($1)", [module]);
  const command = (
    module: string,
    action: string,
    data: Record<string, unknown> = {},
    id = randomUUID(),
  ) =>
    scalar<{ ok: boolean; id: string }>(
      "select operations_command($1,$2,$3,$4)",
      [
        id,
        module,
        action,
        JSON.stringify({
          reason: "Operação sintética de homologação",
          ...data,
        }),
      ],
    );
  await user(admin);
  const location = await scalar(
    "select id from storage_locations where name='Freezer 1'",
  );
  const category = await scalar(
    "select id from categories where name='Frutas recebidas'",
  );
  const save = (entity: string, values: unknown) =>
    scalar("select save_catalog($1,null,$2,'Cadastro sintético')", [
      entity,
      JSON.stringify(values),
    ]);
  const product = await save("products", {
    name: "Fruta sintética operações",
    category_id: category,
    requires_expiry: true,
    has_variants: true,
  });
  const variant = await save("variants", {
    name: "Unidade",
    product_id: product,
    sku: "OPS-TEST",
    unit_weight_kg: 1,
  });
  const supplier = await save("suppliers", { name: "Fornecedor sintético" });
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const receiptId = await scalar("select receive_delivery($1,$2)", [
    randomUUID(),
    JSON.stringify({
      supplier_id: supplier,
      reference: "NF-OPS",
      received_at: new Date(Date.now() - 86400000).toISOString(),
      items: [
        {
          product_id: product,
          variant_id: variant,
          location_id: location,
          quantity: 20,
          unit: "un",
          total_cost: 100,
          expires_on: tomorrow,
          expiry_source: "supplier",
          inspection_notes: "Inspeção sintética",
        },
      ],
    }),
  ]);
  const lot = await scalar("select id from lots where receipt_id=$1", [
    receiptId,
  ]);

  await t.test(
    "idempotent command retries cannot change intent or actor",
    async () => {
      const id = randomUUID();
      const payload = { name: "Conta teste", kind: "bank" };
      const first = await command("finance", "account_create", payload, id);
      assert.deepEqual(
        await command("finance", "account_create", payload, id),
        first,
      );
      await assert.rejects(
        command("finance", "account_create", { ...payload, name: "Outra" }, id),
        /Identificador reutilizado/,
      );
      await user(approver);
      await assert.rejects(
        command("finance", "account_create", payload, id),
        /Identificador reutilizado/,
      );
      await user(admin);
    },
  );

  await t.test(
    "counts append compensating adjustments and require independent approval",
    async () => {
      const session = await command("inventory", "count_open", {
        location_id: location,
      });
      await command("inventory", "count_line", {
        session_id: session.id,
        lot_id: lot,
        counted_quantity: 18,
      });
      await assert.rejects(
        command("inventory", "count_approve", { session_id: session.id }),
        /outro aprovador/,
      );
      await user(approver);
      await command("inventory", "count_approve", { session_id: session.id });
      assert.equal(
        Number(await scalar("select quantity from lots where id=$1", [lot])),
        18,
      );
      const adjustment = await scalar(
        "select id from stock_movements where inventory_count_id=$1",
        [session.id],
      );
      await command("inventory", "compensate", { movement_id: adjustment });
      assert.equal(
        Number(await scalar("select quantity from lots where id=$1", [lot])),
        20,
      );
      await assert.rejects(
        command("inventory", "compensate", { movement_id: adjustment }),
        /unique constraint/,
      );
      await user(admin);
      assert.equal(
        Number(
          await scalar(
            "select sum(quantity) from stock_movements where lot_id=$1",
            [lot],
          ),
        ),
        20,
      );
      const stale = await command("inventory", "count_open", {
        location_id: location,
      });
      await command("inventory", "count_line", {
        session_id: stale.id,
        lot_id: lot,
        counted_quantity: 19,
      });
      await db.query(
        "select move_stock($1,$2,'loss',1,'Perda operacional',now())",
        [randomUUID(), lot],
      );
      await user(approver);
      await assert.rejects(
        command("inventory", "count_approve", { session_id: stale.id }),
        /Saldo mudou/,
      );
      await user(admin);
    },
  );

  await t.test(
    "inspection freezes template revision and validates every criterion",
    async () => {
      const template = await command("receiving", "template_create", {
        name: "Conferência NF",
        criteria: [
          {
            key: "packaging",
            label: "Embalagem íntegra",
            type: "boolean",
            required: true,
          },
        ],
      });
      await assert.rejects(
        command("receiving", "inspect", {
          receipt_id: receiptId,
          template_id: template.id,
          decision: "accepted",
          responses: {},
          notes: "",
        }),
        /obrigatório/,
      );
      await assert.rejects(
        command("receiving", "inspect", {
          receipt_id: receiptId,
          template_id: template.id,
          decision: "accepted",
          responses: { packaging: "sim" },
          notes: "",
        }),
        /Tipo inválido/,
      );
      await command("receiving", "inspect", {
        receipt_id: receiptId,
        template_id: template.id,
        decision: "accepted",
        responses: { packaging: true },
        notes: "Sem parâmetro sanitário fictício",
      });
      const next = await command("receiving", "template_create", {
        name: "Conferência NF",
        criteria: [
          {
            key: "invoice",
            label: "Documento conferido",
            type: "boolean",
            required: true,
          },
        ],
      });
      assert.notEqual(next.id, template.id);
      const data = await snapshot("receiving");
      assert.equal(data.inspections[0].template_id, template.id);
      assert.equal(data.templates[0].revision, 2);
      await assert.rejects(
        command("receiving", "attachment_register", {
          receipt_id: receiptId,
          object_name: `${receiptId}/${admin}/${randomUUID()}.pdf`,
          mime_type: "application/pdf",
          size_bytes: 10,
        }),
        /Storage privado não disponível/,
      );
    },
  );

  await t.test(
    "manager cannot promote admins or block managers, inactive staff loses access immediately",
    async () => {
      await user(manager);
      await assert.rejects(
        command("staff", "save", {
          user_id: outsider,
          display_name: "Admin invasor",
          role: "admin",
        }),
        /Gestor só cadastra/,
      );
      await assert.rejects(
        command("staff", "block", { user_id: admin }),
        /só bloqueia/,
      );
      await assert.rejects(
        command("finance", "account_create", { name: "Negado", kind: "cash" }),
        /Acesso não autorizado/,
      );
      await command("staff", "save", {
        user_id: outsider,
        display_name: "Novo gestor",
        role: "manager",
      });
      await command("staff", "block", { user_id: collaborator });
      await user(collaborator);
      await assert.rejects(snapshot("time"), /Acesso não autorizado/);
      await user(manager);
      await command("staff", "reactivate", { user_id: collaborator });
      await user(admin);
    },
  );

  await t.test(
    "alerts use real readings and deduplicate evaluation",
    async () => {
      await command("alerts", "rule_save", {
        name: "Leitura ausente",
        kind: "missing_reading",
        location_id: location,
        threshold: 2,
        active: true,
      });
      await command("alerts", "evaluate");
      assert.equal(
        (await snapshot("alerts")).events.filter((row) => row.status === "open")
          .length,
        1,
      );
      await command("alerts", "evaluate");
      assert.equal((await snapshot("alerts")).events.length, 1);
      await command("alerts", "reading_record", {
        location_id: location,
        value_c: -12.5,
        measured_at: new Date(Date.now() - 1000).toISOString(),
        equipment: "Termômetro sintético",
      });
      await command("alerts", "evaluate");
      assert.equal((await snapshot("alerts")).events[0].status, "resolved");
      await command("alerts", "rule_save", {
        name: "Limite sintético para teste",
        kind: "temperature",
        location_id: location,
        lower_limit: -30,
        upper_limit: -15,
        active: true,
      });
      await command("alerts", "evaluate");
      assert.equal(
        (await snapshot("alerts")).events.filter((row) => row.status === "open")
          .length,
        1,
      );
    },
  );

  let account: string, title: string;
  await t.test(
    "financial origin deduplication, partial payments, reconciliation and reversals",
    async () => {
      account = (await snapshot("finance")).accounts[0].id as string;
      title = (
        await command("finance", "title_create", {
          kind: "payable",
          description: "NF sintética",
          amount: 100,
          competence_on: today,
          due_on: today,
          source_type: "receipt",
          source_id: receiptId,
        })
      ).id;
      await assert.rejects(
        command("finance", "title_create", {
          kind: "payable",
          description: "Duplicada",
          amount: 100,
          competence_on: today,
          due_on: today,
          source_type: "receipt",
          source_id: receiptId,
        }),
        /Origem já vinculada/,
      );
      const settlement = await command("finance", "settle", {
        title_id: title,
        account_id: account,
        amount: 40,
        paid_on: today,
      });
      assert.equal(
        Number((await snapshot("finance")).titles[0].outstanding_amount),
        60,
      );
      await assert.rejects(
        command("finance", "settle", {
          title_id: title,
          account_id: account,
          amount: 61,
          paid_on: today,
        }),
        /excede saldo/,
      );
      await command("finance", "reconcile", {
        settlement_id: settlement.id,
        external_reference: "EXTRATO-SINTETICO-1",
      });
      await command("finance", "reverse", { settlement_id: settlement.id });
      assert.equal(
        Number((await snapshot("finance")).titles[0].outstanding_amount),
        100,
      );
      assert.equal(
        Number((await snapshot("finance")).balances[0].recorded_balance),
        0,
      );
      await assert.rejects(
        command("finance", "reverse", { settlement_id: settlement.id }),
        /já estornada/,
      );
      await assert.rejects(
        command("finance", "settle", {
          title_id: title,
          account_id: account,
          amount: "0.001",
          paid_on: today,
        }),
        /Valor inválido/,
      );
    },
  );

  let customer: string, order: string, shipmentLine: string;
  await t.test(
    "orders reserve logical balance and ship atomically once with exact lot genealogy",
    async () => {
      customer = (
        await command("commercial", "customer_create", {
          name: "Cliente sintético A",
          user_id: customerUser,
        })
      ).id;
      await command("commercial", "customer_create", {
        name: "Cliente sintético B",
        user_id: otherCustomerUser,
      });
      const catalog = (
        await command("commercial", "catalog_save", {
          variant_id: variant,
          name: "Oferta sintética",
          unit: "un",
          price: 10,
          active: true,
        })
      ).id;
      order = (
        await command("commercial", "order_create", {
          customer_id: customer,
          items: [{ catalog_id: catalog, quantity: 5 }],
        })
      ).id;
      const line = (await snapshot("commercial")).lines.find(
        (row) => row.order_id === order,
      )!.id;
      const physicalBefore = Number(
        await scalar("select quantity from lots where id=$1", [lot]),
      );
      await assert.rejects(
        command("commercial", "reserve", {
          order_id: order,
          allocations: [{ line_id: line, lot_id: lot, quantity: 6 }],
        }),
        /exatamente/,
      );
      assert.equal(
        (await snapshot("commercial")).reservations.length,
        0,
        "failed reservation rolled back all inserted rows",
      );
      await command("commercial", "reserve", {
        order_id: order,
        allocations: [{ line_id: line, lot_id: lot, quantity: 5 }],
      });
      assert.equal(
        Number(await scalar("select quantity from lots where id=$1", [lot])),
        physicalBefore,
      );
      await assert.rejects(
        db.query(
          "select move_stock($1,$2,'loss',$3,'Perda operacional',now())",
          [randomUUID(), lot, physicalBefore - 4],
        ),
        /reservas comerciais/,
      );
      const shipId = randomUUID();
      await command("commercial", "ship", { order_id: order }, shipId);
      await command("commercial", "ship", { order_id: order }, shipId);
      assert.equal(
        Number(await scalar("select quantity from lots where id=$1", [lot])),
        physicalBefore - 5,
      );
      assert.equal((await snapshot("commercial")).shipments.length, 1);
      shipmentLine = (await snapshot("commercial")).shipment_lines[0]
        .id as string;
      await command("commercial", "return", {
        shipment_line_id: shipmentLine,
        quantity: 1,
      });
      assert.equal(
        Number(await scalar("select quantity from lots where id=$1", [lot])),
        physicalBefore - 5,
      );
      await assert.rejects(
        command("commercial", "return", {
          shipment_line_id: shipmentLine,
          quantity: 5,
        }),
        /excede quantidade/,
      );
    },
  );

  await t.test(
    "customer portal only exposes the authenticated customer's order and permitted trace",
    async () => {
      await user(customerUser);
      const portal = await snapshot("commercial");
      assert.equal(portal.orders.length, 1);
      assert.equal(portal.orders[0].id, order);
      assert.equal(portal.customers.length, 1);
      assert.equal(portal.shipment_lines[0].id, shipmentLine);
      assert.ok(!JSON.stringify(portal).includes("supplier"));
      assert.ok(!JSON.stringify(portal).includes("total_cost"));
      assert.equal(portal.lots, undefined);
      await assert.rejects(
        command("commercial", "order_create", {
          customer_id: customer,
          items: [],
        }),
        /Acesso não autorizado/,
      );
      await user(otherCustomerUser);
      assert.equal((await snapshot("commercial")).orders.length, 0);
      await user(admin);
    },
  );

  await t.test(
    "time entries are own operational records, corrections append history and no payroll exists",
    async () => {
      await user(collaborator);
      await assert.rejects(
        command("time", "record", {
          kind: "end",
          occurred_at: new Date().toISOString(),
          notes: "",
        }),
        /Sequência/,
      );
      const entry = await command("time", "record", {
        kind: "start",
        occurred_at: new Date(Date.now() - 3600000).toISOString(),
        notes: "Apontamento sintético",
      });
      await command("time", "correct", {
        entry_id: entry.id,
        occurred_at: new Date(Date.now() - 3500000).toISOString(),
      });
      assert.equal((await snapshot("time")).entries.length, 2);
      await user(admin);
      assert.equal((await snapshot("time")).entries.length, 0);
      await assert.rejects(
        command("time", "correct", {
          entry_id: entry.id,
          occurred_at: new Date().toISOString(),
        }),
        /próprio/,
      );
    },
  );

  await t.test(
    "direct writes and anonymous calls are denied; history is immutable even to an owner mutation",
    async () => {
      await assert.rejects(
        db.query(
          "insert into financial_accounts(name,kind,created_by) values ('Bypass','cash',$1)",
          [admin],
        ),
        /permission denied/,
      );
      await assert.rejects(
        db.query("update staff_members set role='admin' where user_id=$1", [
          collaborator,
        ]),
        /permission denied/,
      );
      await db.exec("reset role");
      await assert.rejects(
        db.exec("delete from audit_events"),
        /Histórico imutável/,
      );
      await assert.rejects(
        db.exec("update financial_titles set amount=0"),
        /Histórico imutável/,
      );
      await user(null);
      await assert.rejects(snapshot("commercial"), /permission denied/);
      await assert.rejects(command("time", "record", {}), /permission denied/);
    },
  );
});
