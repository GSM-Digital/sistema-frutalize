-- Simplifica o recebimento para itens comuns e agrupa vários lotes na mesma entrega.
-- A camada interna de variantes é preservada para compatibilidade e rastreabilidade.

alter table public.products
  add column has_variants boolean not null default false;

alter table public.item_variants
  add column is_default boolean not null default false;

-- Produtos que já tinham tamanhos cadastrados continuam usando saldos separados.
update public.products p
set has_variants = exists (
  select 1 from public.item_variants v where v.product_id = p.id
);

-- Itens sem tamanho ganham uma configuração técnica, invisível para o usuário.
insert into public.item_variants (product_id, sku, name, is_default, active)
select
  p.id,
  'ITEM-' || upper(substr(replace(p.id::text, '-', ''), 1, 12)),
  'Padrão',
  true,
  p.active
from public.products p
where not p.has_variants
  and not exists (
    select 1 from public.item_variants v where v.product_id = p.id
  );

create unique index item_variants_one_default_per_product
  on public.item_variants(product_id)
  where is_default;

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  supplier_id uuid not null references public.suppliers(id),
  reference text not null check(length(trim(reference)) between 1 and 80),
  received_at timestamptz not null,
  item_count integer not null check(item_count between 1 and 50),
  total_cost numeric(14,2) not null check(total_cost between 0 and 999999999),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check(received_at >= '1900-01-01'::timestamptz)
);

create index receipts_supplier_idx on public.receipts(supplier_id);
create index receipts_created_idx on public.receipts(created_at desc, id);

alter table public.receipts enable row level security;
revoke all on public.receipts from anon, authenticated;
grant select on public.receipts to authenticated;
create policy inventory_admin_read on public.receipts
  for select to authenticated
  using ((select public.can_manage_inventory()));

alter table public.lots
  add column receipt_id uuid references public.receipts(id);
create index lots_receipt_idx on public.lots(receipt_id);

create or replace function private.save_catalog(
  p_entity text,
  p_id uuid,
  p_values jsonb,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_table text;
  v_old jsonb;
  v_data jsonb;
begin
  if not public.can_manage_inventory() then
    raise exception 'Acesso não autorizado.' using errcode = '42501';
  end if;
  if p_entity is null or p_entity not in ('categories','products','variants','suppliers','locations') then
    raise exception 'Cadastro inválido.';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 240 then
    raise exception 'Informe o motivo da alteração.';
  end if;

  v_table := case p_entity
    when 'variants' then 'item_variants'
    when 'locations' then 'storage_locations'
    else p_entity
  end;

  if p_id is not null then
    execute format(
      'select to_jsonb(t) from public.%I t where id = $1 for update',
      v_table
    ) into v_old using p_id;
    if v_old is null then raise exception 'Cadastro não encontrado.'; end if;
  end if;

  v_data := coalesce(v_old, '{"active":true}'::jsonb) || p_values;
  perform set_config('frutalize.reason', trim(p_reason), true);

  case p_entity
    when 'categories' then
      insert into public.categories(id, name, active)
      values(v_id, trim(v_data->>'name'), (v_data->>'active')::boolean)
      on conflict(id) do update
        set name = excluded.name, active = excluded.active;

    when 'products' then
      insert into public.products(
        id, category_id, name, requires_expiry, has_variants, active
      ) values(
        v_id,
        (v_data->>'category_id')::uuid,
        trim(v_data->>'name'),
        (v_data->>'requires_expiry')::boolean,
        coalesce((v_data->>'has_variants')::boolean, false),
        (v_data->>'active')::boolean
      )
      on conflict(id) do update set
        category_id = excluded.category_id,
        name = excluded.name,
        requires_expiry = excluded.requires_expiry,
        has_variants = excluded.has_variants,
        active = excluded.active;

      if not coalesce((v_data->>'has_variants')::boolean, false) then
        insert into public.item_variants(
          product_id, sku, name, is_default, active
        ) values(
          v_id,
          'ITEM-' || upper(substr(replace(v_id::text, '-', ''), 1, 12)),
          'Padrão',
          true,
          (v_data->>'active')::boolean
        )
        on conflict(product_id) where is_default do update
          set active = excluded.active;
      end if;

    when 'variants' then
      if coalesce((v_old->>'is_default')::boolean, false) then
        raise exception 'A configuração padrão é gerenciada automaticamente.';
      end if;
      if p_id is not null
        and (v_data->>'product_id')::uuid <> (v_old->>'product_id')::uuid
        and exists(select 1 from public.lots where variant_id = p_id)
      then
        raise exception 'Um tamanho com histórico não pode mudar de item.';
      end if;
      if not exists(
        select 1
        from public.products
        where id = (v_data->>'product_id')::uuid and has_variants
      ) then
        raise exception 'Este item recebe entrada direta e não usa tamanhos separados.';
      end if;
      insert into public.item_variants(
        id, product_id, sku, name, unit_weight_kg, is_default, active
      ) values(
        v_id,
        (v_data->>'product_id')::uuid,
        upper(trim(v_data->>'sku')),
        trim(v_data->>'name'),
        nullif(v_data->>'unit_weight_kg', '')::numeric,
        false,
        (v_data->>'active')::boolean
      )
      on conflict(id) do update set
        product_id = excluded.product_id,
        sku = excluded.sku,
        name = excluded.name,
        unit_weight_kg = excluded.unit_weight_kg,
        active = excluded.active;

    when 'suppliers' then
      insert into public.suppliers(
        id, name, cnpj, phone, address, contact_name, active
      ) values(
        v_id,
        trim(v_data->>'name'),
        coalesce(v_data->>'cnpj',''),
        coalesce(v_data->>'phone',''),
        coalesce(v_data->>'address',''),
        coalesce(v_data->>'contact_name',''),
        (v_data->>'active')::boolean
      )
      on conflict(id) do update set
        name = excluded.name,
        cnpj = excluded.cnpj,
        phone = excluded.phone,
        address = excluded.address,
        contact_name = excluded.contact_name,
        active = excluded.active;

    when 'locations' then
      insert into public.storage_locations(id, name, description, active)
      values(
        v_id,
        trim(v_data->>'name'),
        coalesce(v_data->>'description',''),
        (v_data->>'active')::boolean
      )
      on conflict(id) do update set
        name = excluded.name,
        description = excluded.description,
        active = excluded.active;
  end case;

  return v_id;
end;
$$;

create function private.receive_delivery(p_request_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt_id uuid;
  v_supplier_id uuid;
  v_reference text;
  v_received_at timestamptz;
  v_items jsonb;
  v_item jsonb;
  v_item_count integer;
  v_item_index integer := 0;
  v_total_cost numeric;
  v_variant public.item_variants;
  v_product public.products;
  v_quantity numeric;
  v_unit text;
  v_weight numeric;
  v_expiry date;
  v_manufactured date;
  v_item_cost numeric;
  v_code text;
  v_lot_id uuid;
  v_movement_request uuid;
begin
  if not public.can_manage_inventory() then
    raise exception 'Acesso não autorizado.' using errcode = '42501';
  end if;
  if p_request_id is null then raise exception 'Identificador obrigatório.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select id into v_receipt_id
  from public.receipts
  where request_id = p_request_id;
  if found then return v_receipt_id; end if;

  v_supplier_id := (p_data->>'supplier_id')::uuid;
  v_reference := trim(p_data->>'reference');
  v_received_at := (p_data->>'received_at')::timestamptz;
  v_items := p_data->'items';
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'Confira os itens desta entrega.';
  end if;
  v_item_count := coalesce(jsonb_array_length(v_items), 0);

  if v_reference is null or length(v_reference) not between 1 and 80 then
    raise exception 'Informe a nota fiscal ou referência da entrega.';
  end if;
  if v_received_at is null
    or v_received_at > now()
    or v_received_at < '1900-01-01'::timestamptz
  then
    raise exception 'Confira a data e a hora do recebimento.';
  end if;
  if v_item_count not between 1 and 50 then
    raise exception 'A entrega deve ter entre 1 e 50 itens.';
  end if;
  perform 1 from public.suppliers
  where id = v_supplier_id and active
  for share;
  if not found then raise exception 'Fornecedor indisponível.'; end if;

  select coalesce(sum((item->>'total_cost')::numeric), 0)
  into v_total_cost
  from jsonb_array_elements(v_items) as entries(item);

  if v_total_cost < 0 or v_total_cost > 999999999 or v_total_cost <> round(v_total_cost, 2) then
    raise exception 'Custo total da entrega inválido.';
  end if;

  insert into public.receipts(
    request_id, supplier_id, reference, received_at, item_count, total_cost
  ) values(
    p_request_id, v_supplier_id, v_reference, v_received_at, v_item_count, v_total_cost
  ) returning id into v_receipt_id;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    v_item_index := v_item_index + 1;

    select * into v_variant
    from public.item_variants
    where id = (v_item->>'variant_id')::uuid and active
    for share;
    if not found then raise exception 'Item % indisponível.', v_item_index; end if;

    select * into v_product
    from public.products
    where id = v_variant.product_id and active
    for share;
    if not found then raise exception 'Produto % indisponível.', v_item_index; end if;

    if (not v_product.has_variants and not v_variant.is_default)
      or (v_product.has_variants and v_variant.is_default)
    then
      raise exception 'Configuração inválida no item %.', v_item_index;
    end if;

    perform 1 from public.categories
    where id = v_product.category_id and active
    for share;
    if not found then raise exception 'Categoria indisponível no item %.', v_item_index; end if;

    perform 1 from public.storage_locations
    where id = (v_item->>'location_id')::uuid and active
    for share;
    if not found then raise exception 'Local indisponível no item %.', v_item_index; end if;

    v_quantity := (v_item->>'quantity')::numeric;
    v_unit := v_item->>'unit';
    v_weight := nullif(v_item->>'net_weight_kg', '')::numeric;
    v_expiry := nullif(v_item->>'expires_on', '')::date;
    v_manufactured := nullif(v_item->>'manufactured_on', '')::date;
    v_item_cost := (v_item->>'total_cost')::numeric;

    if v_quantity is null
      or v_quantity <= 0
      or v_quantity > 999999999
      or v_quantity <> round(v_quantity, 3)
      or v_unit is null
      or v_unit not in ('kg','g','l','un','pct','cx')
      or (v_unit in ('un','pct','cx') and v_quantity <> trunc(v_quantity))
    then
      raise exception 'Quantidade ou unidade inválida no item %.', v_item_index;
    end if;

    if v_product.requires_expiry and v_expiry is null then
      raise exception 'Informe a validade do item %.', v_item_index;
    end if;
    if (v_expiry is null) <> ((v_item->>'expiry_source') = 'not_applicable') then
      raise exception 'Confira a validade e sua origem no item %.', v_item_index;
    end if;
    if coalesce(v_item->>'expiry_source', '') not in ('supplier','internal','not_applicable') then
      raise exception 'Origem da validade inválida no item %.', v_item_index;
    end if;
    if v_expiry is not null
      and (v_expiry < (now() at time zone 'America/Sao_Paulo')::date
        or v_expiry < (v_received_at at time zone 'America/Sao_Paulo')::date)
    then
      raise exception 'Validade inválida no item %.', v_item_index;
    end if;
    if v_manufactured is not null
      and v_manufactured > (v_received_at at time zone 'America/Sao_Paulo')::date
    then
      raise exception 'Data de fabricação inválida no item %.', v_item_index;
    end if;
    if v_item_cost is null
      or v_item_cost < 0
      or v_item_cost > 999999999
      or v_item_cost <> round(v_item_cost, 2)
    then
      raise exception 'Preço total inválido no item %.', v_item_index;
    end if;
    if v_weight is not null
      and (v_weight <= 0 or v_weight > 999999999 or v_weight <> round(v_weight, 6))
    then
      raise exception 'Peso líquido inválido no item %.', v_item_index;
    end if;
    if length(trim(v_item->>'inspection_notes')) not between 3 and 1000 then
      raise exception 'Descreva a conferência do item %.', v_item_index;
    end if;

    -- Somente conversões exatas. Pacotes e caixas nunca são estimados.
    if v_unit = 'kg' then
      v_weight := v_quantity;
    elsif v_unit = 'g' then
      v_weight := v_quantity / 1000;
    elsif v_unit = 'un' and v_variant.unit_weight_kg is not null then
      v_weight := v_quantity * v_variant.unit_weight_kg;
    end if;

    v_code := coalesce(
      nullif(upper(trim(v_item->>'code')), ''),
      v_variant.sku || '-' ||
        to_char(v_received_at at time zone 'America/Sao_Paulo', 'YYYYMMDD') || '-' ||
        nextval('public.lot_code_sequence')::text
    );

    insert into public.lots(
      receipt_id, code, variant_id, location_id, supplier_id, supplier_lot,
      reference, received_at, manufactured_on, expires_on, expiry_source,
      unit, initial_quantity, initial_weight_kg, total_cost, quantity,
      inspection_notes
    ) values(
      v_receipt_id,
      v_code,
      v_variant.id,
      (v_item->>'location_id')::uuid,
      v_supplier_id,
      coalesce(v_item->>'supplier_lot', ''),
      v_reference,
      v_received_at,
      v_manufactured,
      v_expiry,
      v_item->>'expiry_source',
      v_unit,
      v_quantity,
      v_weight,
      v_item_cost,
      v_quantity,
      trim(v_item->>'inspection_notes')
    ) returning id into v_lot_id;

    v_movement_request := md5(p_request_id::text || ':' || v_item_index::text)::uuid;
    insert into public.stock_movements(
      request_id, lot_id, kind, quantity, balance_after, reason,
      operated_at, actor_name
    ) values(
      v_movement_request,
      v_lot_id,
      'receipt',
      v_quantity,
      v_quantity,
      'Recebimento em quarentena',
      v_received_at,
      (select display_name from public.staff_members where user_id = auth.uid())
    );
  end loop;

  insert into public.audit_events(
    entity, record_id, action, before_data, after_data, reason,
    created_by, actor_name
  ) values(
    'receipts',
    v_receipt_id,
    'INSERT',
    null,
    jsonb_build_object(
      'supplier_id', v_supplier_id,
      'reference', v_reference,
      'received_at', v_received_at,
      'item_count', v_item_count,
      'total_cost', v_total_cost
    ),
    'Recebimento de mercadoria',
    auth.uid(),
    (select display_name from public.staff_members where user_id = auth.uid())
  );

  return v_receipt_id;
end;
$$;

revoke all on function private.receive_delivery(uuid, jsonb)
  from public, anon;
grant execute on function private.receive_delivery(uuid, jsonb)
  to authenticated;

create function public.receive_delivery(p_request_id uuid, p_data jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.receive_delivery(p_request_id, p_data);
$$;

revoke all on function public.receive_delivery(uuid, jsonb)
  from public, anon;
grant execute on function public.receive_delivery(uuid, jsonb)
  to authenticated;

drop view public.inventory_movements;
drop view public.inventory_lots;
drop view public.inventory_variants;

create view public.inventory_variants
with(security_invoker = true)
as
select
  v.*,
  p.name as product_name,
  p.requires_expiry,
  p.has_variants,
  p.active as product_active,
  c.name as category_name,
  c.active as category_active,
  concat_ws(' ', p.name, case when v.is_default then null else v.name end, v.sku) as search_text
from public.item_variants v
join public.products p on p.id = v.product_id
join public.categories c on c.id = p.category_id;

create view public.inventory_lots
with(security_invoker = true)
as
select
  l.*,
  p.name as product_name,
  v.name as variant_name,
  v.sku,
  v.is_default,
  p.has_variants,
  s.name as location_name,
  f.name as supplier_name,
  l.initial_weight_kg * l.quantity / l.initial_quantity as remaining_weight_kg,
  concat_ws(' ', l.code, p.name, case when v.is_default then null else v.name end, v.sku, s.name, f.name) as search_text
from public.lots l
join public.item_variants v on v.id = l.variant_id
join public.products p on p.id = v.product_id
join public.storage_locations s on s.id = l.location_id
join public.suppliers f on f.id = l.supplier_id;

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
  concat_ws(' ', l.code, p.name, case when v.is_default then null else v.name end, v.sku, m.reason, m.actor_name) as search_text
from public.stock_movements m
join public.lots l on l.id = m.lot_id
join public.item_variants v on v.id = l.variant_id
join public.products p on p.id = v.product_id
join public.storage_locations s on s.id = l.location_id;

grant select on public.inventory_variants, public.inventory_lots, public.inventory_movements
  to authenticated;
revoke all on public.inventory_variants, public.inventory_lots, public.inventory_movements
  from anon;
