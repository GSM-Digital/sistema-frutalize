-- Initial slice of Requisitos_Sistema_Frutalize.md. Only admin is enabled;
-- manager/collaborator remain denied until their permission matrix is approved.
create table public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 120),
  role text not null default 'collaborator' check (role in ('admin','manager','collaborator')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create function public.can_manage_inventory() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.staff_members where user_id = (select auth.uid()) and active and role = 'admin');
$$;
revoke all on function public.can_manage_inventory() from public, anon;
grant execute on function public.can_manage_inventory() to authenticated;

create table public.categories (
  id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 80),
  active boolean not null default true, created_at timestamptz not null default now()
);
create unique index categories_name_unique on public.categories(lower(trim(name)));
create table public.products (
  id uuid primary key default gen_random_uuid(), category_id uuid not null references public.categories(id),
  name text not null check(length(trim(name)) between 2 and 120), requires_expiry boolean not null default true,
  active boolean not null default true, created_at timestamptz not null default now()
);
create unique index products_name_unique on public.products(lower(trim(name)));
create index products_category_idx on public.products(category_id);
create table public.item_variants (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
  sku text not null unique check(sku = upper(trim(sku)) and sku ~ '^[A-Z0-9][A-Z0-9._-]{0,39}$'),
  name text not null check(length(trim(name)) between 2 and 80),
  unit_weight_kg numeric(14,6) check(unit_weight_kg > 0 and unit_weight_kg <= 999999),
  active boolean not null default true, created_at timestamptz not null default now(), unique(product_id,name)
);
create table public.suppliers (
  id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 120),
  cnpj text not null default '' check(cnpj = '' or cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$'),
  phone text not null default '' check(length(phone) <= 30), address text not null default '' check(length(address) <= 240),
  contact_name text not null default '' check(length(contact_name) <= 120), active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index suppliers_cnpj_unique on public.suppliers(cnpj) where cnpj <> '';
create table public.storage_locations (
  id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 80),
  description text not null default '' check(length(description) <= 240), active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index storage_locations_name_unique on public.storage_locations(lower(trim(name)));
create sequence public.lot_code_sequence;
create table public.lots (
  id uuid primary key default gen_random_uuid(), code text not null check(length(trim(code)) between 1 and 80),
  variant_id uuid not null references public.item_variants(id), location_id uuid not null references public.storage_locations(id),
  supplier_id uuid not null references public.suppliers(id), supplier_lot text not null default '' check(length(supplier_lot) <= 80),
  reference text not null check(length(trim(reference)) between 1 and 80), received_at timestamptz not null,
  manufactured_on date, expires_on date, expiry_source text not null check(expiry_source in ('supplier','internal','not_applicable')),
  unit text not null check(unit in ('kg','g','l','un','pct','cx')),
  initial_quantity numeric(14,3) not null check(initial_quantity > 0 and initial_quantity <= 999999999),
  initial_weight_kg numeric(17,6) check(initial_weight_kg > 0),
  total_cost numeric(14,2) not null check(total_cost between 0 and 999999999),
  unit_cost numeric generated always as (total_cost / initial_quantity) stored,
  quantity numeric(14,3) not null check(quantity between 0 and 999999999),
  status text not null default 'quarantine' check(status in ('quarantine','released','blocked')),
  inspection_notes text not null check(length(trim(inspection_notes)) between 3 and 1000),
  created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(),
  check(expires_on is null or expires_on >= (received_at at time zone 'America/Sao_Paulo')::date),
  check(manufactured_on is null or manufactured_on <= (received_at at time zone 'America/Sao_Paulo')::date),
  check((expires_on is null) = (expiry_source = 'not_applicable')),
  unique(variant_id,code,location_id)
);
create index lots_expiry_idx on public.lots(expires_on) where quantity > 0;
create index lots_variant_idx on public.lots(variant_id);
create index lots_location_idx on public.lots(location_id);
create index lots_supplier_idx on public.lots(supplier_id);
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(), request_id uuid not null unique, lot_id uuid not null references public.lots(id),
  kind text not null check(kind in ('receipt','dispatch','loss','release','block','quarantine')), quantity numeric(14,3) not null,
  balance_after numeric(14,3) not null check(balance_after >= 0), reason text not null check(length(trim(reason)) between 3 and 240),
  operated_at timestamptz not null, created_by uuid not null default auth.uid() references auth.users(id), actor_name text not null,
  created_at timestamptz not null default now(),
  check((kind = 'receipt' and quantity > 0) or (kind in ('dispatch','loss') and quantity < 0) or (kind in ('release','block','quarantine') and quantity = 0))
);
create index stock_movements_created_idx on public.stock_movements(created_at desc,id);
create index stock_movements_lot_idx on public.stock_movements(lot_id);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(), entity text not null, record_id uuid not null, action text not null,
  before_data jsonb, after_data jsonb, reason text not null, created_by uuid references auth.users(id), actor_name text not null,
  created_at timestamptz not null default now()
);
create index audit_events_created_idx on public.audit_events(created_at desc,id);

-- Explicit exposure; direct writes to all tables are prohibited, including audit.
do $$ declare t text; begin
  foreach t in array array['staff_members','categories','products','item_variants','suppliers','storage_locations','lots','stock_movements','audit_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    if t <> 'staff_members' then
      execute format('create policy inventory_admin_read on public.%I for select to authenticated using ((select public.can_manage_inventory()))',t);
    end if;
  end loop;
end $$;
create policy staff_self_read on public.staff_members for select to authenticated using(user_id = (select auth.uid()));

create function public.audit_catalog_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events(entity,record_id,action,before_data,after_data,reason,created_by,actor_name)
  values(tg_table_name,new.id,tg_op,case when tg_op = 'UPDATE' then to_jsonb(old) else null end,to_jsonb(new),
    coalesce(nullif(current_setting('frutalize.reason',true),''),'Cadastro inicial'),auth.uid(),
    coalesce((select display_name from public.staff_members where user_id = auth.uid()),'Configuração inicial'));
  return new;
end;
$$;
revoke all on function public.audit_catalog_change() from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['categories','products','item_variants','suppliers','storage_locations'] loop
    execute format('create trigger audit_change after insert or update on public.%I for each row execute function public.audit_catalog_change()',t);
  end loop;
end $$;

create function public.save_catalog(p_entity text,p_id uuid,p_values jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := coalesce(p_id,gen_random_uuid()); v_table text; v_old jsonb; v_data jsonb;
begin
  if not public.can_manage_inventory() then raise exception 'Acesso não autorizado.' using errcode = '42501'; end if;
  if p_entity is null or p_entity not in ('categories','products','variants','suppliers','locations') then raise exception 'Cadastro inválido.'; end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 240 then raise exception 'Informe o motivo da alteração.'; end if;
  v_table := case p_entity when 'variants' then 'item_variants' when 'locations' then 'storage_locations' else p_entity end;
  if p_id is not null then
    execute format('select to_jsonb(t) from public.%I t where id = $1 for update',v_table) into v_old using p_id;
    if v_old is null then raise exception 'Cadastro não encontrado.'; end if;
  end if;
  v_data := coalesce(v_old,'{"active":true}'::jsonb) || p_values;
  perform set_config('frutalize.reason',trim(p_reason),true);
  case p_entity
    when 'categories' then
      insert into public.categories(id,name,active) values(v_id,trim(v_data->>'name'),(v_data->>'active')::boolean)
      on conflict(id) do update set name = excluded.name, active = excluded.active;
    when 'products' then
      insert into public.products(id,category_id,name,requires_expiry,active)
      values(v_id,(v_data->>'category_id')::uuid,trim(v_data->>'name'),(v_data->>'requires_expiry')::boolean,(v_data->>'active')::boolean)
      on conflict(id) do update set category_id = excluded.category_id, name = excluded.name, requires_expiry = excluded.requires_expiry, active = excluded.active;
    when 'variants' then
      if p_id is not null and (v_data->>'product_id')::uuid <> (v_old->>'product_id')::uuid and exists(select 1 from public.lots where variant_id = p_id) then
        raise exception 'Uma apresentação com histórico não pode mudar de produto.';
      end if;
      insert into public.item_variants(id,product_id,sku,name,unit_weight_kg,active)
      values(v_id,(v_data->>'product_id')::uuid,upper(trim(v_data->>'sku')),trim(v_data->>'name'),nullif(v_data->>'unit_weight_kg','')::numeric,(v_data->>'active')::boolean)
      on conflict(id) do update set product_id = excluded.product_id, sku = excluded.sku, name = excluded.name, unit_weight_kg = excluded.unit_weight_kg, active = excluded.active;
    when 'suppliers' then
      insert into public.suppliers(id,name,cnpj,phone,address,contact_name,active)
      values(v_id,trim(v_data->>'name'),coalesce(v_data->>'cnpj',''),coalesce(v_data->>'phone',''),coalesce(v_data->>'address',''),coalesce(v_data->>'contact_name',''),(v_data->>'active')::boolean)
      on conflict(id) do update set name = excluded.name, cnpj = excluded.cnpj, phone = excluded.phone, address = excluded.address, contact_name = excluded.contact_name, active = excluded.active;
    when 'locations' then
      insert into public.storage_locations(id,name,description,active)
      values(v_id,trim(v_data->>'name'),coalesce(v_data->>'description',''),(v_data->>'active')::boolean)
      on conflict(id) do update set name = excluded.name, description = excluded.description, active = excluded.active;
  end case;
  return v_id;
end;
$$;

create function public.receive_lot(p_request_id uuid,p_data jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_variant public.item_variants; v_product public.products; v_qty numeric;
  v_unit text; v_weight numeric; v_date timestamptz; v_expiry date; v_cost numeric; v_code text;
begin
  if not public.can_manage_inventory() then raise exception 'Acesso não autorizado.' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'Identificador obrigatório.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select lot_id into v_id from public.stock_movements where request_id = p_request_id;
  if found then return v_id; end if;
  select * into v_variant from public.item_variants where id = (p_data->>'variant_id')::uuid and active for share;
  if not found then raise exception 'Apresentação indisponível.'; end if;
  select * into v_product from public.products where id = v_variant.product_id and active for share;
  if not found then raise exception 'Produto indisponível.'; end if;
  perform 1 from public.categories where id = v_product.category_id and active for share;
  if not found then raise exception 'Categoria indisponível.'; end if;
  perform 1 from public.storage_locations where id = (p_data->>'location_id')::uuid and active for share;
  if not found then raise exception 'Local indisponível.'; end if;
  perform 1 from public.suppliers where id = (p_data->>'supplier_id')::uuid and active for share;
  if not found then raise exception 'Fornecedor indisponível.'; end if;
  v_qty := (p_data->>'quantity')::numeric; v_unit := p_data->>'unit'; v_weight := nullif(p_data->>'net_weight_kg','')::numeric;
  v_date := (p_data->>'received_at')::timestamptz; v_expiry := nullif(p_data->>'expires_on','')::date; v_cost := (p_data->>'total_cost')::numeric;
  if v_qty is null or v_qty <= 0 or v_qty > 999999999 or v_qty <> round(v_qty,3) or v_unit is null or v_unit not in ('kg','g','l','un','pct','cx')
    or (v_unit in ('un','pct','cx') and v_qty <> trunc(v_qty)) then raise exception 'Quantidade ou unidade inválida.'; end if;
  if v_date is null or v_date > now() or v_date < '1900-01-01'::timestamptz or (v_product.requires_expiry and v_expiry is null)
    or (v_expiry is not null and v_expiry < (now() at time zone 'America/Sao_Paulo')::date) then raise exception 'Confira as datas e a validade exigida pelo produto.'; end if;
  if v_cost is null or v_cost < 0 or v_cost > 999999999 or v_cost <> round(v_cost,2) then raise exception 'Preço total inválido.'; end if;
  if v_weight is not null and (v_weight <= 0 or v_weight > 999999999 or v_weight <> round(v_weight,6)) then raise exception 'Peso líquido inválido.'; end if;
  -- Only exact mass conversions and a known unit weight. Never estimate boxes.
  if v_unit = 'kg' then v_weight := v_qty;
  elsif v_unit = 'g' then v_weight := v_qty / 1000;
  elsif v_unit = 'un' and v_variant.unit_weight_kg is not null then v_weight := v_qty * v_variant.unit_weight_kg;
  end if;
  v_code := coalesce(nullif(upper(trim(p_data->>'code')),''),v_variant.sku || '-' || to_char(v_date at time zone 'America/Sao_Paulo','YYYYMMDD') || '-' || nextval('public.lot_code_sequence')::text);
  insert into public.lots(code,variant_id,location_id,supplier_id,supplier_lot,reference,received_at,manufactured_on,expires_on,expiry_source,unit,initial_quantity,initial_weight_kg,total_cost,quantity,inspection_notes)
  values(v_code,v_variant.id,(p_data->>'location_id')::uuid,(p_data->>'supplier_id')::uuid,coalesce(p_data->>'supplier_lot',''),trim(p_data->>'reference'),v_date,
    nullif(p_data->>'manufactured_on','')::date,v_expiry,p_data->>'expiry_source',v_unit,v_qty,v_weight,v_cost,v_qty,trim(p_data->>'inspection_notes')) returning id into v_id;
  insert into public.stock_movements(request_id,lot_id,kind,quantity,balance_after,reason,operated_at,actor_name)
  values(p_request_id,v_id,'receipt',v_qty,v_qty,'Recebimento em quarentena',v_date,(select display_name from public.staff_members where user_id = auth.uid()));
  return v_id;
end;
$$;

create function public.move_stock(p_request_id uuid,p_lot_id uuid,p_kind text,p_quantity numeric,p_reason text,p_operated_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_lot public.lots; v_id uuid;
begin
  if not public.can_manage_inventory() then raise exception 'Acesso não autorizado.' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'Identificador obrigatório.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select id into v_id from public.stock_movements where request_id = p_request_id;
  if found then return v_id; end if;
  select * into v_lot from public.lots where id = p_lot_id for update;
  if not found then raise exception 'Lote não encontrado.'; end if;
  if p_kind is null or p_kind not in ('dispatch','loss') then raise exception 'Tipo de movimentação inválido.'; end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 999999999 or p_quantity <> round(p_quantity,3)
    or (v_lot.unit in ('un','pct','cx') and p_quantity <> trunc(p_quantity)) then raise exception 'Quantidade inválida para a unidade do lote.'; end if;
  if p_quantity > v_lot.quantity then raise exception 'Saldo insuficiente neste lote.'; end if;
  if p_operated_at is null or p_operated_at > now() or p_operated_at < v_lot.received_at then raise exception 'Data operacional fora do período do lote.'; end if;
  if p_kind = 'dispatch' and (v_lot.status <> 'released' or v_lot.expires_on < (now() at time zone 'America/Sao_Paulo')::date) then raise exception 'Saídas exigem um lote liberado e dentro da validade.'; end if;
  update public.lots set quantity = quantity - p_quantity where id = p_lot_id;
  insert into public.stock_movements(request_id,lot_id,kind,quantity,balance_after,reason,operated_at,actor_name)
  values(p_request_id,p_lot_id,p_kind,-p_quantity,v_lot.quantity - p_quantity,trim(p_reason),p_operated_at,
    (select display_name from public.staff_members where user_id = auth.uid())) returning id into v_id;
  return v_id;
end;
$$;
create function public.set_lot_status(p_request_id uuid,p_lot_id uuid,p_status text,p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_lot public.lots; v_id uuid;
begin
  if not public.can_manage_inventory() then raise exception 'Acesso não autorizado.' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'Identificador obrigatório.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select id into v_id from public.stock_movements where request_id = p_request_id;
  if found then return v_id; end if;
  select * into v_lot from public.lots where id = p_lot_id for update;
  if not found then raise exception 'Lote não encontrado.'; end if;
  if p_status is null or p_status not in ('released','blocked','quarantine') then raise exception 'Situação inválida.'; end if;
  if p_status = v_lot.status then raise exception 'O lote já está nessa situação.'; end if;
  if v_lot.quantity = 0 then raise exception 'Lote sem saldo.'; end if;
  if p_status = 'released' and v_lot.expires_on < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Lotes vencidos não podem ser liberados.'; end if;
  update public.lots set status = p_status where id = p_lot_id;
  insert into public.stock_movements(request_id,lot_id,kind,quantity,balance_after,reason,operated_at,actor_name)
  values(p_request_id,p_lot_id,case p_status when 'released' then 'release' when 'blocked' then 'block' else 'quarantine' end,0,v_lot.quantity,trim(p_reason),now(),
    (select display_name from public.staff_members where user_id = auth.uid())) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.save_catalog(text,uuid,jsonb,text), public.receive_lot(uuid,jsonb), public.move_stock(uuid,uuid,text,numeric,text,timestamptz), public.set_lot_status(uuid,uuid,text,text) from public, anon;
grant execute on function public.save_catalog(text,uuid,jsonb,text), public.receive_lot(uuid,jsonb), public.move_stock(uuid,uuid,text,numeric,text,timestamptz), public.set_lot_status(uuid,uuid,text,text) to authenticated;
revoke all on sequence public.lot_code_sequence from public, anon, authenticated;

create view public.inventory_variants with(security_invoker = true) as
select v.*,p.name as product_name,p.requires_expiry,p.active as product_active,c.name as category_name,c.active as category_active,concat_ws(' ',p.name,v.name,v.sku) as search_text
from public.item_variants v join public.products p on p.id = v.product_id join public.categories c on c.id = p.category_id;
create view public.inventory_lots with(security_invoker = true) as
select l.*,p.name as product_name,v.name as variant_name,v.sku,s.name as location_name,f.name as supplier_name,
  l.initial_weight_kg * l.quantity / l.initial_quantity as remaining_weight_kg,concat_ws(' ',l.code,p.name,v.name,v.sku,s.name,f.name) as search_text
from public.lots l join public.item_variants v on v.id = l.variant_id join public.products p on p.id = v.product_id
join public.storage_locations s on s.id = l.location_id join public.suppliers f on f.id = l.supplier_id;
create view public.inventory_movements with(security_invoker = true) as
select m.*,l.code as lot_code,l.unit,p.name as product_name,v.name as variant_name,v.sku,s.name as location_name,concat_ws(' ',l.code,p.name,v.name,v.sku,m.reason,m.actor_name) as search_text
from public.stock_movements m join public.lots l on l.id = m.lot_id join public.item_variants v on v.id = l.variant_id
join public.products p on p.id = v.product_id join public.storage_locations s on s.id = l.location_id;
grant select on public.inventory_variants, public.inventory_lots, public.inventory_movements to authenticated;
revoke all on public.inventory_variants, public.inventory_lots, public.inventory_movements from anon;
create function public.inventory_overview()
returns table(products_count bigint,lots_count bigint,quarantine_count bigint,expiring_count bigint,expired_count bigint)
language sql stable security invoker set search_path = '' as $$
  select (select count(*) from public.products where active),count(*) filter(where quantity > 0),count(*) filter(where quantity > 0 and status = 'quarantine'),
    count(*) filter(where quantity > 0 and expires_on between (now() at time zone 'America/Sao_Paulo')::date and (now() at time zone 'America/Sao_Paulo')::date + 30),
    count(*) filter(where quantity > 0 and expires_on < (now() at time zone 'America/Sao_Paulo')::date) from public.lots;
$$;
revoke all on function public.inventory_overview() from public, anon;
grant execute on function public.inventory_overview() to authenticated;

-- Confirmed categories/locations. No invented balances, presentations or expiry.
insert into public.categories(name) values('Frutas recebidas'),('Polpas prontas'),('Embalagens'),('Rótulos'),('Caixas'),('Limpeza e sanitização'),('Uniformes e EPIs'),('Materiais administrativos'),('Outros');
insert into public.storage_locations(name) values('Estoque de frutas'),('Estoque de insumos'),('Produção'),('Quarentena'),('Freezer 1'),('Freezer 2'),('Freezer 3');
