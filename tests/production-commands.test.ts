import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

type Result = {
  ok: boolean;
  id?: string;
  code?: string;
  revision?: number;
  currentRevision?: number;
  snapshot?: Run;
};
type Run = {
  id: string;
  code: string;
  revision: number;
  phase: number;
  step: number;
  operational_status: string;
  output_lot_id: string | null;
  procedure: { id: string; revision: number };
  qualityChecks: { id: string; net: number; passed: boolean }[];
  nonconformities: { id: string; status: string }[];
};

test("approved production commands, quality, revisions and authorization", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create schema auth; create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function extensions.gen_salt(text, integer default 6) returns text language sql volatile as $$ select md5(random()::text) $$;
    create function extensions.crypt(value text, salt text) returns text language sql immutable as $$ select md5(value||salt) $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
  `);
  const migrationDir = new URL("../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(migrationDir)).sort()) {
    if (
      name > "20261028100000_production_commands.sql" ||
      !name.endsWith(".sql")
    )
      continue;
    const sql = (await readFile(new URL(name, migrationDir), "utf8")).replace(
      "create extension if not exists pgcrypto with schema extensions;",
      "",
    );
    await db.exec(sql);
  }
  const admin = randomUUID();
  const operator = randomUUID();
  const manager = randomUUID();
  const outsider = randomUUID();
  await db.query("insert into auth.users(id) values ($1),($2),($3),($4)", [
    admin,
    operator,
    manager,
    outsider,
  ]);
  await db.query(
    "insert into staff_members(user_id,display_name,role) values ($1,'Admin teste','admin'),($2,'Operador teste','collaborator'),($3,'Gestor teste','manager')",
    [admin, operator, manager],
  );
  async function user(id: string) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  }
  async function scalar<T = string>(sql: string, args: unknown[] = []) {
    const { rows } = await db.query<Record<string, T>>(sql, args);
    return Object.values(rows[0])[0];
  }
  async function adminCommand(
    kind: string,
    payload: unknown,
    id = randomUUID(),
  ) {
    return scalar<Result>("select production_admin_command($1,$2,$3)", [
      id,
      kind,
      JSON.stringify(payload),
    ]);
  }
  const command = (
    run: string | null,
    revision: number,
    kind: string,
    payload: unknown = {},
    id = randomUUID(),
  ) =>
    scalar<Result>("select production_command($1,$2,$3,$4,$5)", [
      id,
      run,
      revision,
      kind,
      JSON.stringify(payload),
    ]);
  await user(admin);
  const fruitCategory = await scalar(
    "select id from categories where name='Frutas recebidas'",
  );
  const pulpCategory = await scalar(
    "select id from categories where name='Polpas prontas'",
  );
  const location = await scalar(
    "select id from storage_locations where name='Freezer 1'",
  );
  const fruit = await scalar(
    "select save_catalog('products',null,$1,'Teste')",
    [
      JSON.stringify({
        name: "Fruta sintética",
        category_id: fruitCategory,
        has_variants: false,
        requires_expiry: true,
      }),
    ],
  );
  const pulp = await scalar("select save_catalog('products',null,$1,'Teste')", [
    JSON.stringify({
      name: "Polpa sintética",
      category_id: pulpCategory,
      has_variants: false,
      requires_expiry: true,
    }),
  ]);
  const fruitVariant = await scalar(
    "select id from item_variants where product_id=$1",
    [fruit],
  );
  const outputVariant = await scalar(
    "select id from item_variants where product_id=$1",
    [pulp],
  );
  const supplier = await scalar(
    "select save_catalog('suppliers',null,$1,'Teste')",
    [JSON.stringify({ name: "Fornecedor sintético" })],
  );
  const lot = await scalar("select receive_lot($1,$2)", [
    randomUUID(),
    JSON.stringify({
      variant_id: fruitVariant,
      supplier_id: supplier,
      location_id: location,
      reference: "NF-SINTETICA",
      received_at: new Date(Date.now() - 60000).toISOString(),
      expires_on: "2099-12-31",
      expiry_source: "supplier",
      unit: "kg",
      quantity: 30,
      total_cost: 300,
      inspection_notes: "Dados sintéticos de teste",
    }),
  ]);
  const secondLot = await scalar("select receive_lot($1,$2)", [
    randomUUID(),
    JSON.stringify({
      variant_id: fruitVariant,
      supplier_id: supplier,
      location_id: location,
      reference: "NF-SINTETICA-UNIDADES",
      received_at: new Date(Date.now() - 60000).toISOString(),
      expires_on: "2099-12-31",
      expiry_source: "supplier",
      unit: "un",
      quantity: 10,
      total_cost: 40,
      inspection_notes: "Unidades sem equivalência de massa presumida",
    }),
  ]);
  const equipment = (
    await adminCommand("save_equipment", {
      name: "Envasadora sintética",
      type: "filler",
      manufacturer: "Fabricante de teste",
      model: "Modelo de teste",
    })
  ).id!;
  const instrument = (
    await adminCommand("save_equipment", {
      name: "Balança sintética",
      type: "scale",
    })
  ).id!;
  const packaging = (
    await adminCommand("save_packaging", {
      name: "Embalagem sintética",
      presentation_g: 100,
      material: "Material de teste",
    })
  ).id!;
  const steps = [
    {
      phase: 1,
      step: 1,
      title: "Conferir",
      instruction: "Conferência de teste",
      kind: "confirm",
    },
    {
      phase: 2,
      step: 1,
      title: "Medir",
      instruction: "Medição de teste",
      kind: "quality",
    },
    {
      phase: 2,
      step: 2,
      title: "Liberar",
      instruction: "Liberação de teste",
      kind: "release",
    },
    {
      phase: 6,
      step: 1,
      title: "Finalizar",
      instruction: "Conferência final de teste",
      kind: "finish",
    },
  ];
  const procedure = (
    await adminCommand("save_procedure", {
      name: "POP sintético",
      product_id: fruit,
      output_variant_id: outputVariant,
      revision: 1,
      steps,
    })
  ).id!;
  const profile = (
    await adminCommand("save_profile", {
      name: "Perfil sintético",
      product_id: fruit,
      output_variant_id: outputVariant,
      equipment_id: equipment,
      packaging_id: packaging,
      revision: 1,
      parameters: [
        {
          name: "Ajuste sintético",
          value: 1,
          min: 0,
          max: 2,
          unit: "un",
          source: "Somente teste automatizado",
        },
      ],
    })
  ).id!;
  const spec = (
    await adminCommand("save_quality_spec", {
      name: "Regra sintética",
      output_variant_id: outputVariant,
      revision: 1,
      unit: "g",
      minimum: 98,
      maximum: 102,
      tare: 2,
      requires_calibration: true,
    })
  ).id!;
  const configuration = {
    procedure_id: procedure,
    profile_id: profile,
    quality_spec_id: spec,
  };
  await t.test(
    "draft versions cannot release an order; approval is ordered and audited",
    async () => {
      await assert.rejects(
        command(null, 0, "create", {
          ...configuration,
          inputs: [{ lot_id: lot, quantity: 5 }],
        }),
        /procedimento aprovado/,
      );
      for (const [entity, id] of [
        ["procedure", procedure],
        ["profile", profile],
        ["quality", spec],
      ]) {
        await assert.rejects(
          adminCommand("approve", {
            entity,
            id,
            reason: "Aprovação sintética",
          }),
          /transição/,
        );
        await adminCommand("review", {
          entity,
          id,
          reason: "Revisão sintética",
        });
        await adminCommand("approve", {
          entity,
          id,
          reason: "Aprovação sintética sem uso real",
        });
      }
      assert.equal(
        Number(await scalar("select count(*) from production_runs")),
        0,
      );
    },
  );

  let run: Run;
  await t.test(
    "idempotent multi-input start consumes once and rolls back invalid inputs",
    async () => {
      await assert.rejects(
        command(null, 0, "create", {
          ...configuration,
          inputs: [{ lot_id: lot, quantity: 31 }],
        }),
        /Saldo insuficiente/,
      );
      const id = randomUUID();
      await assert.rejects(
        command(null, 0, "create", {
          ...configuration,
          inputs: [
            { lot_id: lot, quantity: 1 },
            { lot_id: secondLot, quantity: 11 },
          ],
        }),
        /Saldo insuficiente/,
      );
      assert.equal(
        Number(await scalar("select quantity from lots where id=$1", [lot])),
        30,
      );
      const payload = {
        ...configuration,
        inputs: [
          { lot_id: lot, quantity: 5 },
          { lot_id: secondLot, quantity: 2 },
        ],
      };
      const first = await command(null, 0, "create", payload, id);
      assert.equal(first.ok, true);
      assert.deepEqual(await command(null, 0, "create", payload, id), first);
      await assert.rejects(
        command(
          null,
          0,
          "create",
          { ...payload, inputs: [{ lot_id: lot, quantity: 6 }] },
          id,
        ),
        /outra intenção/,
      );
      run = first.snapshot!;
      assert.equal(
        Number(await scalar("select quantity from lots where id=$1", [lot])),
        25,
      );
      assert.equal(
        Number(
          await scalar("select quantity from lots where id=$1", [secondLot]),
        ),
        8,
      );
      assert.equal(
        Number(
          await scalar(
            "select count(*) from production_inputs where production_run_id=$1",
            [run.id],
          ),
        ),
        2,
      );
    },
  );
  await t.test(
    "pause time comes from the server and cancellation preserves consumed inputs and reserved code",
    async () => {
      const created = await command(null, 0, "create", {
        ...configuration,
        inputs: [{ lot_id: lot, quantity: 1 }],
      });
      let separate = created.snapshot!;
      separate = (await command(separate.id, separate.revision, "claim"))
        .snapshot!;
      await assert.rejects(
        command(separate.id, separate.revision, "pause", {
          reason: "Pausa sintética",
          safe_point_confirmed: false,
        }),
        /ponto físico seguro/,
      );
      separate = (
        await command(separate.id, separate.revision, "pause", {
          reason: "Pausa sintética",
          safe_point_confirmed: true,
        })
      ).snapshot!;
      await db.exec("reset role");
      await db.query(
        "update production_runs set paused_at=now()-interval '2 seconds' where id=$1",
        [separate.id],
      );
      await user(admin);
      separate = (await command(separate.id, separate.revision, "resume"))
        .snapshot!;
      const pausedSeconds = await scalar<number>(
        "select paused_seconds from production_runs where id=$1",
        [separate.id],
      );
      assert.ok(Number(pausedSeconds) >= 2);
      await assert.rejects(
        command(separate.id, separate.revision, "cancel", {
          reason: "Cancelamento sintético",
          disposition: "returned",
          destination: "Estoque",
        }),
        /compensatório separado/,
      );
      const cancellationId = randomUUID();
      const cancellation = {
        reason: "Cancelamento sintético",
        disposition: "segregated",
        destination: "Área fictícia do teste",
      };
      const cancelled = await command(
        separate.id,
        separate.revision,
        "cancel",
        cancellation,
        cancellationId,
      );
      assert.equal(cancelled.snapshot!.operational_status, "cancelled");
      assert.equal(cancelled.snapshot!.code, created.snapshot!.code);
      assert.deepEqual(
        await command(
          separate.id,
          separate.revision,
          "cancel",
          cancellation,
          cancellationId,
        ),
        cancelled,
      );
      assert.equal(
        Number(await scalar("select quantity from lots where id=$1", [lot])),
        24,
      );
      assert.equal(
        Number(
          await scalar(
            "select count(*) from production_inputs where production_run_id=$1",
            [separate.id],
          ),
        ),
        1,
      );
      assert.equal(
        (
          await scalar<{ runs: Run[] }>("select production_terminal_snapshot()")
        ).runs.some((item) => item.id === separate.id),
        false,
      );
    },
  );
  await t.test(
    "operators see no costs and cannot call inventory or administration RPCs",
    async () => {
      await user(operator);
      const terminal = await scalar<Record<string, unknown>>(
        "select production_terminal_snapshot()",
      );
      const encoded = JSON.stringify(terminal);
      assert.doesNotMatch(
        encoded,
        /unit_cost|input_cost|total_cost|production_pin_hash/,
      );
      assert.equal(
        (await db.query("select * from inventory_production_runs")).rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from production_run_events")).rows.length,
        0,
      );
      await assert.rejects(
        scalar("select production_admin_snapshot()"),
        /Acesso não autorizado/,
      );
      assert.equal((await command(null, 0, "create", {})).code, "FORBIDDEN");
      assert.equal(
        (
          await command(run.id, run.revision, "confirm_step", {
            phase: 1,
            step: 1,
          })
        ).code,
        "FORBIDDEN",
      );
      run = (await command(run.id, run.revision, "claim")).snapshot!;
    },
  );
  await t.test(
    "double taps, stale revisions and changed payloads never overwrite a checkpoint",
    async () => {
      const revision = run.revision;
      const id = randomUUID();
      const payload = { phase: 1, step: 1 };
      const confirmed = await command(
        run.id,
        revision,
        "confirm_step",
        payload,
        id,
      );
      assert.equal(confirmed.ok, true);
      assert.deepEqual(
        await command(run.id, revision, "confirm_step", payload, id),
        confirmed,
      );
      run = confirmed.snapshot!;
      const conflict = await command(run.id, revision, "confirm_step", payload);
      assert.equal(conflict.code, "CONFLICT");
      assert.equal(conflict.currentRevision, run.revision);
      assert.deepEqual(conflict.snapshot, run);
      await assert.rejects(
        command(run.id, run.revision, "confirm_step", { phase: 6, step: 1 }),
        /passo atual/,
      );
      await assert.rejects(
        command(run.id, run.revision, "issue", {
          reason: "teste",
          pin: "1234",
        }),
        /Credenciais/,
      );
    },
  );
  await t.test(
    "quality uses frozen rules and calibration; failure blocks release and creates a deviation",
    async () => {
      const measure = {
        gross: 102,
        tare: 2,
        unit: "g",
        instrument_id: instrument,
      };
      await assert.rejects(
        command(run.id, run.revision, "quality_check", measure),
        /calibração válida/,
      );
      await user(admin);
      await adminCommand("calibrate", {
        equipment_id: instrument,
        calibrated_at: new Date(Date.now() - 60000).toISOString(),
        valid_until: "2099-12-31T00:00:00Z",
        reference: "Certificado sintético para teste",
      });
      await user(operator);
      assert.equal(
        (
          await command(run.id, run.revision, "confirm_step", {
            phase: 2,
            step: 1,
          })
        ).code,
        "QUALITY_BLOCK",
      );
      run = (
        await command(run.id, run.revision, "quality_check", {
          ...measure,
          gross: 90,
        })
      ).snapshot!;
      assert.equal(run.operational_status, "paused");
      assert.equal(run.qualityChecks[0].passed, false);
      assert.equal(run.nonconformities[0].status, "open");
      assert.equal(
        (await command(run.id, run.revision, "resume")).code,
        "QUALITY_BLOCK",
      );
      assert.equal(
        (
          await command(run.id, run.revision, "resolve_nonconformity", {
            id: run.nonconformities[0].id,
          })
        ).code,
        "FORBIDDEN",
      );
      run = (await command(run.id, run.revision, "quality_check", measure))
        .snapshot!;
      assert.equal(run.qualityChecks[0].net, 100);
      await user(manager);
      for (const status of ["contained", "assessed", "closed"]) {
        run = (
          await command(run.id, run.revision, "resolve_nonconformity", {
            id: run.nonconformities[0].id,
            status,
            decision: "Material sintético segregado no teste",
            reason: "Decisão sintética sem aplicação sanitária",
          })
        ).snapshot!;
      }
      await user(operator);
      run = (await command(run.id, run.revision, "resume")).snapshot!;
      run = (
        await command(run.id, run.revision, "confirm_step", {
          phase: 2,
          step: 1,
        })
      ).snapshot!;
      run = (
        await command(run.id, run.revision, "confirm_step", {
          phase: 2,
          step: 2,
        })
      ).snapshot!;
      assert.equal(run.operational_status, "in_progress");
    },
  );
  await t.test(
    "later revisions never change the procedure of an existing order",
    async () => {
      await user(admin);
      const before = JSON.parse(JSON.stringify(run.procedure));
      const nextProcedure = (
        await adminCommand("save_procedure", {
          name: "POP sintético revisão 2",
          product_id: fruit,
          output_variant_id: outputVariant,
          revision: 2,
          steps: steps.map((step) => ({
            ...step,
            instruction: "Instrução nova apenas em futuras ordens",
          })),
        })
      ).id!;
      await adminCommand("review", {
        entity: "procedure",
        id: nextProcedure,
        reason: "Teste de revisão",
      });
      await adminCommand("approve", {
        entity: "procedure",
        id: nextProcedure,
        reason: "Aprovação sintética",
      });
      await adminCommand("retire", {
        entity: "procedure",
        id: procedure,
        reason: "Substituição sintética",
      });
      const snapshot = await scalar<{ runs: Run[] }>(
        "select production_terminal_snapshot()",
      );
      assert.deepEqual(
        snapshot.runs.find((item) => item.id === run.id)!.procedure,
        before,
      );
      await assert.rejects(
        db.query(
          "update procedure_versions set name='Alteração indevida' where id=$1",
          [procedure],
        ),
        /permission denied/,
      );
      await db.exec("reset role");
      await assert.rejects(
        db.query(
          "update procedure_versions set name='Alteração indevida' where id=$1",
          [procedure],
        ),
        /imutável/,
      );
      await assert.rejects(
        db.query(
          "delete from production_run_events where production_run_id=$1",
          [run.id],
        ),
        /imutável/,
      );
      await user(operator);
    },
  );
  await t.test(
    "completion is atomic, idempotent and retains source genealogy",
    async () => {
      await assert.rejects(
        command(run.id, run.revision, "complete", {}),
        /Conclua todos/,
      );
      run = (
        await command(run.id, run.revision, "confirm_step", {
          phase: 6,
          step: 1,
        })
      ).snapshot!;
      assert.equal(run.operational_status, "awaiting_review");
      const id = randomUUID();
      const payload = {
        location_id: location,
        quantity: 4,
        unit: "kg",
        expires_on: "2099-12-31",
        notes: "Lote sintético de teste",
      };
      const completed = await command(
        run.id,
        run.revision,
        "complete",
        payload,
        id,
      );
      assert.deepEqual(
        await command(run.id, run.revision, "complete", payload, id),
        completed,
      );
      run = completed.snapshot!;
      assert.equal(run.operational_status, "completed");
      await user(admin);
      assert.equal(
        await scalar("select code from lots where id=$1", [run.output_lot_id]),
        run.code,
      );
      assert.equal(
        Number(
          await scalar("select total_cost from lots where id=$1", [
            run.output_lot_id,
          ]),
        ),
        58,
      );
      assert.equal(
        Number(
          await scalar(
            "select count(*) from production_inputs where production_run_id=(select production_run_id from lots where id=$1)",
            [run.output_lot_id],
          ),
        ),
        2,
      );
      await assert.rejects(
        scalar("select complete_production($1,$2,'{}')", [
          randomUUID(),
          run.id,
        ]),
        /novo terminal/,
      );
      await assert.rejects(
        scalar(
          "select save_production_progress($1,1::smallint,1::smallint,'{}')",
          [run.id],
        ),
        /desativado/,
      );
    },
  );
  await t.test("revocation stops a session already authenticated", async () => {
    await db.exec("reset role");
    await db.query("update staff_members set active=false where user_id=$1", [
      operator,
    ]);
    await user(operator);
    assert.equal(
      (await command(run.id, run.revision, "claim")).code,
      "FORBIDDEN",
    );
    await assert.rejects(
      scalar("select production_terminal_snapshot()"),
      /não autorizado/,
    );
    await user(outsider);
    assert.equal(
      (await command(run.id, run.revision, "claim")).code,
      "FORBIDDEN",
    );
    await db.exec("set role anon");
    await assert.rejects(
      scalar("select production_terminal_snapshot()"),
      /permission denied/,
    );
  });
});
