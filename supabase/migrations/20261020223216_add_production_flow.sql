-- Separa consumo de produção, saída externa e perda/descarte.
-- Cada envio à produção cria um processo rastreável; sua finalização gera
-- um novo lote de polpa, ligado aos lotes de origem e ao freezer escolhido.

create sequence public.production_code_sequence;
revoke all on sequence public.production_code_sequence
  from public, anon, authenticated;

-- Produção passa a ser um processo rastreável, não um local com saldo.
-- O cadastro é apenas arquivado para preservar eventuais vínculos históricos.
update public.storage_locations
set active = false
where lower(trim(name)) = 'produção';

create table public.production_runs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  completion_request_id uuid unique,
  code text not null unique check(length(trim(code)) between 1 and 80),
  status text not null default 'in_progress'
    check(status in ('in_progress', 'completed')),
  started_at timestamptz not null,
  completed_at timestamptz,
  output_lot_id uuid,
  created_by uuid not null default auth.uid() references auth.users(id),
  completed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check(completed_at is null or completed_at >= started_at),
  check(
    (status = 'in_progress' and completed_at is null and output_lot_id is null)
    or (status = 'completed' and completed_at is not null and output_lot_id is not null)
  )
);

alter table public.lots
  alter column supplier_id drop not null,
  add column production_run_id uuid references public.production_runs(id);

alter table public.production_runs
  add constraint production_runs_output_lot_fk
  foreign key(output_lot_id) references public.lots(id);

create table public.production_inputs (
  id uuid primary key default gen_random_uuid(),
  production_run_id uuid not null references public.production_runs(id),
  source_lot_id uuid not null references public.lots(id),
  movement_id uuid not null unique references public.stock_movements(id),
  quantity numeric(14,3) not null check(quantity > 0 and quantity <= 999999999),
  unit text not null check(unit in ('kg','g','l','un','pct','cx')),
  input_cost numeric(14,2) not null check(input_cost between 0 and 999999999),
  created_at timestamptz not null default now()
);

create index production_runs_status_idx
  on public.production_runs(status, started_at desc, id);
create index production_inputs_run_idx
  on public.production_inputs(production_run_id);
create index production_inputs_lot_idx
  on public.production_inputs(source_lot_id);
create index lots_production_run_idx
  on public.lots(production_run_id);

do $$
declare
  v_table text;
begin
  foreach v_table in array array['production_runs', 'production_inputs']
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on public.%I from anon, authenticated', v_table);
    execute format('grant select on public.%I to authenticated', v_table);
    execute format(
      'create policy inventory_admin_read on public.%I for select to authenticated using ((select public.can_manage_inventory()))',
      v_table
    );
  end loop;
end;
$$;

alter table public.stock_movements
  drop constraint stock_movements_kind_check,
  drop constraint stock_movements_quantity_kind_check;

alter table public.stock_movements
  add constraint stock_movements_kind_check
    check(kind in (
      'receipt', 'dispatch', 'external_dispatch', 'loss', 'note',
      'production_input', 'production_output'
    )),
  add constraint stock_movements_quantity_kind_check
    check(
      (kind in ('receipt', 'production_output') and quantity > 0)
      or (kind in ('dispatch', 'external_dispatch', 'loss', 'production_input') and quantity < 0)
      or (kind = 'note' and quantity = 0)
    );

create or replace function private.move_stock(
  p_request_id uuid,
  p_lot_id uuid,
  p_kind text,
  p_quantity numeric,
  p_reason text,
  p_operated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.lots;
  v_id uuid;
  v_reason text;
begin
  if not public.can_manage_inventory() then
    raise exception 'Acesso não autorizado.' using errcode = '42501';
  end if;
  if p_request_id is null then raise exception 'Identificador obrigatório.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select id into v_id
  from public.stock_movements
  where request_id = p_request_id;
  if found then return v_id; end if;

  select * into v_lot
  from public.lots
  where id = p_lot_id
  for update;
  if not found then raise exception 'Lote não encontrado.'; end if;

  if p_kind is null or p_kind not in ('external_dispatch', 'loss') then
    raise exception 'Tipo de movimentação inválido.';
  end if;
  if p_kind = 'external_dispatch' and p_reason not in (
    'Devolução ao fornecedor', 'Doação', 'Uso interno', 'Outra saída'
  ) then
    raise exception 'Selecione um destino válido para a saída.';
  end if;
  v_reason := case
    when p_kind = 'external_dispatch' then p_reason
    when v_lot.expires_on is not null
      and v_lot.expires_on < (now() at time zone 'America/Sao_Paulo')::date
      then 'Produto vencido'
    else 'Perda operacional'
  end;
  if p_quantity is null
    or p_quantity <= 0
    or p_quantity > 999999999
    or p_quantity <> round(p_quantity, 3)
    or (v_lot.unit in ('un', 'pct', 'cx') and p_quantity <> trunc(p_quantity))
  then
    raise exception 'Quantidade inválida para a unidade do lote.';
  end if;
  if p_quantity > v_lot.quantity then
    raise exception 'Saldo insuficiente neste lote.';
  end if;
  if p_operated_at is null
    or p_operated_at > now()
    or p_operated_at < v_lot.received_at
  then
    raise exception 'Data operacional fora do período do lote.';
  end if;
  if p_kind = 'external_dispatch'
    and v_lot.expires_on < (now() at time zone 'America/Sao_Paulo')::date
  then
    raise exception 'Lotes vencidos não podem registrar saída externa.';
  end if;

  update public.lots
  set quantity = quantity - p_quantity
  where id = p_lot_id;

  insert into public.stock_movements(
    request_id, lot_id, kind, quantity, balance_after, reason,
    operated_at, actor_name
  ) values(
    p_request_id,
    p_lot_id,
    p_kind,
    -p_quantity,
    v_lot.quantity - p_quantity,
    v_reason,
    p_operated_at,
    (select display_name from public.staff_members where user_id = auth.uid())
  ) returning id into v_id;

  return v_id;
end;
$$;

create function private.start_production(
  p_request_id uuid,
  p_lot_id uuid,
  p_quantity numeric,
  p_operated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.lots;
  v_run_id uuid;
  v_movement_id uuid;
  v_code text;
begin
  if not public.can_manage_inventory() then
    raise exception 'Acesso não autorizado.' using errcode = '42501';
  end if;
  if p_request_id is null then raise exception 'Identificador obrigatório.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select id into v_run_id
  from public.production_runs
  where request_id = p_request_id;
  if found then return v_run_id; end if;

  select * into v_lot
  from public.lots
  where id = p_lot_id
  for update;
  if not found then raise exception 'Lote não encontrado.'; end if;

  if p_quantity is null
    or p_quantity <= 0
    or p_quantity > 999999999
    or p_quantity <> round(p_quantity, 3)
    or (v_lot.unit in ('un', 'pct', 'cx') and p_quantity <> trunc(p_quantity))
  then
    raise exception 'Quantidade inválida para a unidade do lote.';
  end if;
  if p_quantity > v_lot.quantity then
    raise exception 'Saldo insuficiente neste lote.';
  end if;
  if p_operated_at is null
    or p_operated_at > now()
    or p_operated_at < v_lot.received_at
  then
    raise exception 'Data operacional fora do período do lote.';
  end if;
  if v_lot.expires_on < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Lotes vencidos não podem ser enviados para produção.';
  end if;
  perform 1
  from public.item_variants variant
  join public.products product on product.id = variant.product_id
  join public.categories category on category.id = product.category_id
  where variant.id = v_lot.variant_id
    and lower(trim(category.name)) = 'frutas recebidas';
  if not found then
    raise exception 'Somente frutas recebidas podem iniciar esta produção.';
  end if;

  v_code := 'PRD-' ||
    to_char(p_operated_at at time zone 'America/Sao_Paulo', 'YYYYMMDD') || '-' ||
    nextval('public.production_code_sequence')::text;

  insert into public.production_runs(request_id, code, started_at)
  values(p_request_id, v_code, p_operated_at)
  returning id into v_run_id;

  update public.lots
  set quantity = quantity - p_quantity
  where id = p_lot_id;

  insert into public.stock_movements(
    request_id, lot_id, kind, quantity, balance_after, reason,
    operated_at, actor_name
  ) values(
    p_request_id,
    p_lot_id,
    'production_input',
    -p_quantity,
    v_lot.quantity - p_quantity,
    'Envio para produção ' || v_code,
    p_operated_at,
    (select display_name from public.staff_members where user_id = auth.uid())
  ) returning id into v_movement_id;

  insert into public.production_inputs(
    production_run_id, source_lot_id, movement_id, quantity, unit, input_cost
  ) values(
    v_run_id,
    p_lot_id,
    v_movement_id,
    p_quantity,
    v_lot.unit,
    round(v_lot.unit_cost * p_quantity, 2)
  );

  insert into public.audit_events(
    entity, record_id, action, before_data, after_data, reason,
    created_by, actor_name
  ) values(
    'production_runs',
    v_run_id,
    'INSERT',
    null,
    jsonb_build_object(
      'code', v_code,
      'source_lot_id', p_lot_id,
      'quantity', p_quantity,
      'unit', v_lot.unit
    ),
    'Produção iniciada',
    auth.uid(),
    (select display_name from public.staff_members where user_id = auth.uid())
  );

  return v_run_id;
end;
$$;

create function private.complete_production(
  p_request_id uuid,
  p_production_id uuid,
  p_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.production_runs;
  v_variant public.item_variants;
  v_product public.products;
  v_quantity numeric;
  v_unit text;
  v_weight numeric;
  v_completed_at timestamptz;
  v_expiry date;
  v_location_id uuid;
  v_total_cost numeric;
  v_lot_id uuid;
  v_code text;
  v_notes text;
begin
  if not public.can_manage_inventory() then
    raise exception 'Acesso não autorizado.' using errcode = '42501';
  end if;
  if p_request_id is null then raise exception 'Identificador obrigatório.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select output_lot_id into v_lot_id
  from public.production_runs
  where completion_request_id = p_request_id;
  if found then return v_lot_id; end if;

  select * into v_run
  from public.production_runs
  where id = p_production_id
  for update;
  if not found then raise exception 'Produção não encontrada.'; end if;
  if v_run.status <> 'in_progress' then
    raise exception 'Esta produção já foi finalizada.';
  end if;

  select * into v_variant
  from public.item_variants
  where id = (p_data->>'variant_id')::uuid and active
  for share;
  if not found then raise exception 'Produto final indisponível.'; end if;

  select * into v_product
  from public.products
  where id = v_variant.product_id and active
  for share;
  if not found then raise exception 'Produto final indisponível.'; end if;

  perform 1
  from public.categories
  where id = v_product.category_id
    and active
    and lower(trim(name)) = 'polpas prontas'
  for share;
  if not found then
    raise exception 'Selecione um item da categoria Polpas prontas.';
  end if;

  if (not v_product.has_variants and not v_variant.is_default)
    or (v_product.has_variants and v_variant.is_default)
  then
    raise exception 'Configuração inválida do produto final.';
  end if;

  v_location_id := (p_data->>'location_id')::uuid;
  perform 1
  from public.storage_locations
  where id = v_location_id
    and active
    and lower(trim(name)) like 'freezer %'
  for share;
  if not found then raise exception 'Selecione um freezer ativo.'; end if;

  v_quantity := (p_data->>'quantity')::numeric;
  v_unit := p_data->>'unit';
  v_weight := nullif(p_data->>'net_weight_kg', '')::numeric;
  v_completed_at := (p_data->>'completed_at')::timestamptz;
  v_expiry := nullif(p_data->>'expires_on', '')::date;
  v_notes := coalesce(
    nullif(trim(p_data->>'notes'), ''),
    'Produção interna finalizada'
  );

  if v_quantity is null
    or v_quantity <= 0
    or v_quantity > 999999999
    or v_quantity <> round(v_quantity, 3)
    or v_unit is null
    or v_unit not in ('kg','g','l','un','pct','cx')
    or (v_unit in ('un','pct','cx') and v_quantity <> trunc(v_quantity))
  then
    raise exception 'Quantidade ou unidade inválida para o produto final.';
  end if;
  if v_weight is not null
    and (v_weight <= 0 or v_weight > 999999999 or v_weight <> round(v_weight, 6))
  then
    raise exception 'Peso líquido inválido.';
  end if;
  if v_completed_at is null
    or v_completed_at > now()
    or v_completed_at < v_run.started_at
  then
    raise exception 'Data de finalização fora do período da produção.';
  end if;
  if v_product.requires_expiry and v_expiry is null then
    raise exception 'Informe a validade do produto final.';
  end if;
  if v_expiry is not null
    and v_expiry < (v_completed_at at time zone 'America/Sao_Paulo')::date
  then
    raise exception 'A validade não pode anteceder a fabricação.';
  end if;
  if length(v_notes) > 1000 then
    raise exception 'Observações acima do limite permitido.';
  end if;

  if v_unit = 'kg' then
    v_weight := v_quantity;
  elsif v_unit = 'g' then
    v_weight := v_quantity / 1000;
  elsif v_unit = 'un' and v_variant.unit_weight_kg is not null then
    v_weight := v_quantity * v_variant.unit_weight_kg;
  end if;

  select coalesce(sum(input_cost), 0)
  into v_total_cost
  from public.production_inputs
  where production_run_id = v_run.id;

  v_code := v_variant.sku || '-' ||
    to_char(v_completed_at at time zone 'America/Sao_Paulo', 'YYYYMMDD') || '-' ||
    nextval('public.lot_code_sequence')::text;

  insert into public.lots(
    production_run_id, code, variant_id, location_id, supplier_id,
    supplier_lot, reference, received_at, manufactured_on, expires_on,
    expiry_source, unit, initial_quantity, initial_weight_kg, total_cost,
    quantity, inspection_notes
  ) values(
    v_run.id,
    v_code,
    v_variant.id,
    v_location_id,
    null,
    '',
    v_run.code,
    v_completed_at,
    (v_completed_at at time zone 'America/Sao_Paulo')::date,
    v_expiry,
    case when v_expiry is null then 'not_applicable' else 'internal' end,
    v_unit,
    v_quantity,
    v_weight,
    v_total_cost,
    v_quantity,
    v_notes
  ) returning id into v_lot_id;

  insert into public.stock_movements(
    request_id, lot_id, kind, quantity, balance_after, reason,
    operated_at, actor_name
  ) values(
    p_request_id,
    v_lot_id,
    'production_output',
    v_quantity,
    v_quantity,
    'Produção finalizada ' || v_run.code,
    v_completed_at,
    (select display_name from public.staff_members where user_id = auth.uid())
  );

  update public.production_runs
  set
    completion_request_id = p_request_id,
    status = 'completed',
    completed_at = v_completed_at,
    output_lot_id = v_lot_id,
    completed_by = auth.uid()
  where id = v_run.id;

  insert into public.audit_events(
    entity, record_id, action, before_data, after_data, reason,
    created_by, actor_name
  ) values(
    'production_runs',
    v_run.id,
    'COMPLETE',
    jsonb_build_object('status', 'in_progress'),
    jsonb_build_object(
      'status', 'completed',
      'output_lot_id', v_lot_id,
      'quantity', v_quantity,
      'unit', v_unit
    ),
    'Produção finalizada',
    auth.uid(),
    (select display_name from public.staff_members where user_id = auth.uid())
  );

  return v_lot_id;
end;
$$;

revoke all on function private.start_production(uuid, uuid, numeric, timestamptz),
  private.complete_production(uuid, uuid, jsonb)
from public, anon;
grant execute on function private.start_production(uuid, uuid, numeric, timestamptz),
  private.complete_production(uuid, uuid, jsonb)
to authenticated;

create function public.start_production(
  p_request_id uuid,
  p_lot_id uuid,
  p_quantity numeric,
  p_operated_at timestamptz
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.start_production(
    p_request_id, p_lot_id, p_quantity, p_operated_at
  );
$$;

create function public.complete_production(
  p_request_id uuid,
  p_production_id uuid,
  p_data jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.complete_production(p_request_id, p_production_id, p_data);
$$;

revoke all on function public.start_production(uuid, uuid, numeric, timestamptz),
  public.complete_production(uuid, uuid, jsonb)
from public, anon;
grant execute on function public.start_production(uuid, uuid, numeric, timestamptz),
  public.complete_production(uuid, uuid, jsonb)
to authenticated;

drop view public.inventory_movements;
drop view public.inventory_lots;

create view public.inventory_lots
with(security_invoker = true)
as
select
  l.*,
  p.name as product_name,
  c.name as category_name,
  v.name as variant_name,
  v.sku,
  v.is_default,
  p.has_variants,
  s.name as location_name,
  coalesce(f.name, 'Produção interna') as supplier_name,
  case when l.production_run_id is null then 'supplier' else 'production' end as origin,
  l.initial_weight_kg * l.quantity / l.initial_quantity as remaining_weight_kg,
  concat_ws(
    ' ',
    l.code,
    p.name,
    case when v.is_default then null else v.name end,
    v.sku,
    s.name,
    f.name,
    case when l.production_run_id is null then null else 'produção interna' end
  ) as search_text
from public.lots l
join public.item_variants v on v.id = l.variant_id
join public.products p on p.id = v.product_id
join public.categories c on c.id = p.category_id
join public.storage_locations s on s.id = l.location_id
left join public.suppliers f on f.id = l.supplier_id;

create view public.inventory_movements
with(security_invoker = true)
as
select
  m.*,
  l.code as lot_code,
  l.unit,
  p.name as product_name,
  v.name as variant_name,
  v.sku,
  v.is_default,
  p.has_variants,
  s.name as location_name,
  concat_ws(
    ' ', l.code, p.name,
    case when v.is_default then null else v.name end,
    v.sku, m.reason, m.actor_name
  ) as search_text
from public.stock_movements m
join public.lots l on l.id = m.lot_id
join public.item_variants v on v.id = l.variant_id
join public.products p on p.id = v.product_id
join public.storage_locations s on s.id = l.location_id;

create view public.inventory_production_runs
with(security_invoker = true)
as
select
  r.*,
  coalesce(inputs.input_count, 0) as input_count,
  coalesce(inputs.total_input_cost, 0) as total_input_cost,
  coalesce(inputs.input_summary, '') as input_summary,
  output_lot.code as output_lot_code,
  output_lot.quantity as output_quantity,
  output_lot.unit as output_unit,
  output_product.name as output_product_name,
  output_variant.name as output_variant_name,
  output_variant.is_default as output_is_default,
  output_location.name as output_location_name
from public.production_runs r
left join lateral (
  select
    count(*) as input_count,
    sum(i.input_cost) as total_input_cost,
    string_agg(
      product.name ||
        case when variant.is_default then '' else ' · ' || variant.name end ||
        ' — ' || i.quantity || ' ' || i.unit,
      ', ' order by i.created_at, i.id
    ) as input_summary
  from public.production_inputs i
  join public.lots source_lot on source_lot.id = i.source_lot_id
  join public.item_variants variant on variant.id = source_lot.variant_id
  join public.products product on product.id = variant.product_id
  where i.production_run_id = r.id
) inputs on true
left join public.lots output_lot on output_lot.id = r.output_lot_id
left join public.item_variants output_variant on output_variant.id = output_lot.variant_id
left join public.products output_product on output_product.id = output_variant.product_id
left join public.storage_locations output_location on output_location.id = output_lot.location_id;

create view public.inventory_production_inputs
with(security_invoker = true)
as
select
  i.*,
  lot.code as source_lot_code,
  product.name as product_name,
  variant.name as variant_name,
  variant.sku,
  variant.is_default,
  location.name as source_location_name
from public.production_inputs i
join public.lots lot on lot.id = i.source_lot_id
join public.item_variants variant on variant.id = lot.variant_id
join public.products product on product.id = variant.product_id
join public.storage_locations location on location.id = lot.location_id;

grant select on public.inventory_lots, public.inventory_movements,
  public.inventory_production_runs, public.inventory_production_inputs
to authenticated;
revoke all on public.inventory_lots, public.inventory_movements,
  public.inventory_production_runs, public.inventory_production_inputs
from anon;
