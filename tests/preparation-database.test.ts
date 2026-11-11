import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("fruit preparation keeps raw and prepared stock separate, with workers and idempotency", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function extensions.gen_salt(text,integer default 6) returns text language sql volatile as $$ select 'test'||md5(random()::text) $$;
    create function extensions.crypt(value text,salt text) returns text language sql immutable as $$ select split_part(salt,'$',1)||'$'||md5(value||split_part(salt,'$',1)) $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;`);
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(migrations))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const sql = (await readFile(new URL(file, migrations), "utf8")).replace(
      "create extension if not exists pgcrypto with schema extensions;",
      "",
    );
    await db.exec(sql);
  }
  const [admin, helper, outsider] = [randomUUID(), randomUUID(), randomUUID()];
  const product = randomUUID(),
    variant = randomUUID(),
    source = randomUUID(),
    supplier = randomUUID();
  const category = (
    await db.query<{ id: string }>(
      "select id from categories where name='Frutas recebidas'",
    )
  ).rows[0].id;
  const location = (
    await db.query<{ id: string }>(
      "select id from storage_locations where name='Freezer 1'",
    )
  ).rows[0].id;
  await db.query("insert into auth.users(id) select unnest($1::uuid[])", [
    [admin, helper, outsider],
  ]);
  await db.query(
    `insert into staff_members(user_id,display_name,role,production_pin_hash)
    values($1,'Admin Preparo','admin',extensions.crypt('1234','salt1')),
      ($2,'Ajudante','collaborator',extensions.crypt('5678','salt2'))`,
    [admin, helper],
  );
  await db.query(
    "insert into products(id,category_id,name,requires_expiry) values($1,$2,'Fruta Teste Preparo',false)",
    [product, category],
  );
  await db.query(
    "insert into item_variants(id,product_id,sku,name,is_default) values($1,$2,'PREP-TEST','Padrão',true)",
    [variant, product],
  );
  await db.query(
    "insert into suppliers(id,name) values($1,'Fornecedor Teste Preparo')",
    [supplier],
  );
  await db.query(
    `insert into lots(id,code,variant_id,location_id,supplier_id,reference,received_at,
    expiry_source,unit,initial_quantity,total_cost,quantity,inspection_notes,created_by)
    values($1,'RAW-PREP-1',$2,$3,$4,'recebimento teste',now(),
      'not_applicable','un',5,100,5,'Lote sintético de teste',$5)`,
    [source, variant, location, supplier, admin],
  );
  async function user(id: string | null) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      id ?? "",
    ]);
    await db.exec(`set role ${id ? "authenticated" : "anon"}`);
  }
  async function command(
    kind: string,
    payload: Record<string, unknown>,
    batchId: string | null = null,
    commandId = randomUUID(),
  ) {
    return (
      await db.query<{ result: { ok: boolean; id?: string; error?: string } }>(
        "select preparation_command($1,$2,$3,$4) as result",
        [commandId, batchId, kind, JSON.stringify(payload)],
      )
    ).rows[0].result;
  }
  await user(outsider);
  await assert.rejects(() => db.query("select preparation_snapshot()"));
  await user(admin);
  const draft = await command("save_guide", {
    productId: product,
    steps: ["Conferir a fruta", "Descascar conforme procedimento"],
  });
  assert.equal(draft.ok, true);
  await command("approve_guide", { guideId: draft.id });
  const startId = randomUUID();
  const started = await command(
    "start",
    { lotId: source, quantity: 2, pin: "1234" },
    null,
    startId,
  );
  assert.equal(started.ok, true);
  assert.equal(
    (
      await command(
        "start",
        { lotId: source, quantity: 2, pin: "1234" },
        null,
        startId,
      )
    ).id,
    started.id,
  );
  await db.exec("reset role");
  await db.query(
    "update preparation_batches set started_at=now()-interval '2 hours' where id=$1",
    [started.id],
  );
  await db.query(
    "update preparation_workers set started_at=now()-interval '2 hours' where batch_id=$1",
    [started.id],
  );
  await user(admin);
  assert.equal((await command("join", { pin: "5678" }, started.id)).ok, true);
  assert.equal((await command("break", { pin: "5678" }, started.id)).ok, true);
  await db.exec("reset role");
  const duringBreak = (
    await db.query<{ value: number }>(
      "select paused_seconds as value from preparation_workers where batch_id=$1 and user_id=$2",
      [started.id, helper],
    )
  ).rows[0].value;
  assert.equal(Number(duringBreak), 0);
  await user(admin);
  assert.equal((await command("resume", { pin: "5678" }, started.id)).ok, true);
  const snap = (
    await db.query<{ snapshot: Record<string, unknown> }>(
      "select preparation_snapshot() as snapshot",
    )
  ).rows[0].snapshot;
  assert.equal(JSON.stringify(snap).includes("totalCost"), false);
  const beforeProduction = (
    await db.query<{ snapshot: { lots: { id: string }[] } }>(
      "select production_terminal_snapshot() as snapshot",
    )
  ).rows[0].snapshot;
  assert.equal(
    beforeProduction.lots.some((item) => item.id === source),
    false,
  );
  assert.equal(
    (
      await command(
        "finish",
        {
          pin: "1234",
          processedQuantity: 1,
          bucketCount: 2,
          destination: "freezer",
          locationId: location,
          weightsKg: null,
        },
        started.id,
      )
    ).ok,
    true,
  );
  await db.exec("reset role");
  const raw = (
    await db.query<{ quantity: number }>(
      "select quantity from lots where id=$1",
      [source],
    )
  ).rows[0];
  assert.equal(Number(raw.quantity), 4);
  const outputs = (
    await db.query<{ origin: string; quantity: number; source_lot_id: string }>(
      `select l.quantity, v.origin, b.source_lot_id from lots l
      join inventory_lots v on v.id=l.id join preparation_batches b on b.id=l.preparation_batch_id
      where l.preparation_batch_id=$1`,
      [started.id],
    )
  ).rows;
  assert.equal(outputs.length, 2);
  assert.ok(
    outputs.every(
      (item) => item.origin === "preparation" && item.source_lot_id === source,
    ),
  );
  const run = randomUUID();
  const rawMovement = randomUUID();
  const preparedMovement = randomUUID();
  await db.query(
    "insert into production_runs(id,request_id,code,started_at,created_by) values($1,$2,'PRD-PREP-TEST',now(),$3)",
    [run, randomUUID(), admin],
  );
  await db.query(
    `insert into stock_movements(id,request_id,lot_id,kind,quantity,balance_after,reason,operated_at,created_by,actor_name)
    values($1,$2,$3,'note',0,4,'Teste de rastreabilidade',now(),$4,'Admin Preparo')`,
    [rawMovement, randomUUID(), source, admin],
  );
  await assert.rejects(() =>
    db.query(
      `insert into production_inputs(production_run_id,source_lot_id,movement_id,quantity,unit,input_cost)
    values($1,$2,$3,1,'un',20)`,
      [run, source, rawMovement],
    ),
  );
  const preparedLot = (
    await db.query<{ id: string }>(
      "select id from lots where preparation_batch_id=$1 limit 1",
      [started.id],
    )
  ).rows[0].id;
  await db.query(
    `insert into stock_movements(id,request_id,lot_id,kind,quantity,balance_after,reason,operated_at,created_by,actor_name)
    values($1,$2,$3,'note',0,1,'Teste de rastreabilidade',now(),$4,'Admin Preparo')`,
    [preparedMovement, randomUUID(), preparedLot, admin],
  );
  await db.query(
    `insert into production_inputs(production_run_id,source_lot_id,movement_id,quantity,unit,input_cost)
    values($1,$2,$3,1,'un',10)`,
    [run, preparedLot, preparedMovement],
  );
  await user(admin);
  const afterProduction = (
    await db.query<{ snapshot: { lots: { id: string; prepared: boolean }[] } }>(
      "select production_terminal_snapshot() as snapshot",
    )
  ).rows[0].snapshot;
  assert.ok(afterProduction.lots.some((item) => item.prepared));
  await db.exec("reset role");
  const movements = (
    await db.query<{ kind: string }>(
      "select kind from stock_movements where lot_id=$1",
      [source],
    )
  ).rows.map((item) => item.kind);
  assert.deepEqual(
    movements.filter((kind) => kind.startsWith("preparation_")).sort(),
    ["preparation_input", "preparation_return"],
  );
  await user(admin);
  const second = await command("start", {
    lotId: source,
    quantity: 1,
    pin: "1234",
  });
  await db.exec("reset role");
  await db.query(
    "update preparation_batches set started_at=now()-interval '1 minute' where id=$1",
    [second.id],
  );
  await db.query(
    "update preparation_workers set started_at=now()-interval '1 minute' where batch_id=$1",
    [second.id],
  );
  await user(admin);
  assert.equal(
    (
      await command(
        "cancel",
        {
          pin: "1234",
          allUnprocessed: true,
          reason: "Nenhuma fruta foi preparada",
        },
        second.id,
      )
    ).ok,
    true,
  );
  await db.exec("reset role");
  assert.equal(
    Number(
      (
        await db.query<{ quantity: number }>(
          "select quantity from lots where id=$1",
          [source],
        )
      ).rows[0].quantity,
    ),
    4,
  );
});
