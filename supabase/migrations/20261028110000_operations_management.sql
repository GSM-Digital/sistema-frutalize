-- F06-F12: commands are transactional, idempotent and audited. No bank transfer,
-- payroll calculation or Auth user creation is performed by these operations.
create table public.operations_commands (
  id uuid primary key, actor_id uuid not null references auth.users(id),
  module text not null, action text not null, fingerprint text not null,
  result jsonb not null, created_at timestamptz not null default now()
);
create table public.inventory_counts (
  id uuid primary key default gen_random_uuid(), location_id uuid not null references public.storage_locations(id),
  status text not null default 'open' check(status in ('open','approved')),
  reason text not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  approved_by uuid references auth.users(id), approved_at timestamptz
);
create table public.inventory_count_lines (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.inventory_counts(id),
  lot_id uuid not null references public.lots(id), expected_quantity numeric(14,3) not null,
  counted_quantity numeric(14,3) not null check(counted_quantity >= 0),
  counted_by uuid not null references auth.users(id), created_at timestamptz not null default now(), unique(session_id,lot_id)
);
create table public.inspection_templates (
  id uuid primary key default gen_random_uuid(), name text not null, revision integer not null check(revision > 0),
  criteria jsonb not null check(jsonb_typeof(criteria) = 'array'),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), unique(name,revision)
);
create table public.receipt_inspections (
  id uuid primary key default gen_random_uuid(), receipt_id uuid not null references public.receipts(id),
  template_id uuid not null references public.inspection_templates(id),
  decision text not null check(decision in ('accepted','rejected')), responses jsonb not null,
  notes text not null default '', created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.private_attachments (
  id uuid primary key default gen_random_uuid(), receipt_id uuid not null references public.receipts(id),
  bucket_id text not null default 'frutalize-receipts' check(bucket_id = 'frutalize-receipts'),
  object_name text not null unique, mime_type text not null check(mime_type in ('image/jpeg','image/png','application/pdf')),
  size_bytes bigint not null check(size_bytes between 1 and 10485760),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.alert_rules (
  id uuid primary key default gen_random_uuid(), name text not null,
  kind text not null check(kind in ('minimum_stock','expiry','temperature','missing_reading')),
  variant_id uuid references public.item_variants(id), category_id uuid references public.categories(id),
  location_id uuid references public.storage_locations(id), threshold numeric, lower_limit numeric, upper_limit numeric,
  active boolean not null default true, created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.temperature_readings (
  id uuid primary key default gen_random_uuid(), location_id uuid not null references public.storage_locations(id),
  value_c numeric(7,3) not null, measured_at timestamptz not null, equipment text not null,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create index temperature_readings_latest_idx on public.temperature_readings(location_id, measured_at desc);
create table public.operational_alerts (
  id uuid primary key default gen_random_uuid(), rule_id uuid not null references public.alert_rules(id),
  event_key text not null, details jsonb not null, status text not null default 'open' check(status in ('open','resolved')),
  created_at timestamptz not null default now(), resolved_at timestamptz, resolved_by uuid references auth.users(id),
  resolution text, unique(rule_id,event_key)
);
create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  kind text not null check(kind in ('cash','bank')), active boolean not null default true,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.financial_titles (
  id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('payable','receivable')),
  description text not null, amount numeric(14,2) not null check(amount > 0),
  competence_on date not null, due_on date not null,
  source_type text check(source_type in ('receipt','production','order')), source_id uuid,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  check((source_type is null) = (source_id is null)), unique(source_type,source_id)
);
create table public.financial_settlements (
  id uuid primary key default gen_random_uuid(), title_id uuid not null references public.financial_titles(id),
  account_id uuid not null references public.financial_accounts(id), amount numeric(14,2) not null check(amount > 0),
  paid_on date not null, reversal_of uuid unique references public.financial_settlements(id),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create index financial_settlements_title_idx on public.financial_settlements(title_id);
create table public.financial_reconciliations (
  id uuid primary key default gen_random_uuid(), settlement_id uuid not null unique references public.financial_settlements(id),
  account_id uuid not null references public.financial_accounts(id), external_reference text not null,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), unique(account_id,external_reference)
);
create table public.sales_customers (
  id uuid primary key default gen_random_uuid(), name text not null, user_id uuid unique references auth.users(id),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.sales_catalog (
  id uuid primary key default gen_random_uuid(), variant_id uuid not null references public.item_variants(id),
  name text not null, unit text not null check(unit in ('kg','g','l','un','pct','cx')),
  price numeric(14,2) not null check(price >= 0), active boolean not null default true,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.sales_orders (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.sales_customers(id),
  status text not null default 'open' check(status in ('open','reserved','shipped','cancelled')),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.sales_order_lines (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.sales_orders(id),
  catalog_id uuid not null references public.sales_catalog(id), variant_id uuid not null references public.item_variants(id),
  description text not null, unit text not null, quantity numeric(14,3) not null check(quantity > 0),
  unit_price numeric(14,2) not null check(unit_price >= 0), created_at timestamptz not null default now()
);
create table public.stock_reservations (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.sales_orders(id),
  line_id uuid not null references public.sales_order_lines(id), lot_id uuid not null references public.lots(id),
  quantity numeric(14,3) not null check(quantity > 0),
  status text not null default 'active' check(status in ('active','released','shipped')),
  created_at timestamptz not null default now()
);
create index stock_reservations_active_lot_idx on public.stock_reservations(lot_id) where status = 'active';
create index sales_order_lines_order_idx on public.sales_order_lines(order_id);
create table public.sales_shipments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.sales_orders(id),
  shipped_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.sales_shipment_lines (
  id uuid primary key default gen_random_uuid(), shipment_id uuid not null references public.sales_shipments(id),
  reservation_id uuid not null unique references public.stock_reservations(id),
  line_id uuid not null references public.sales_order_lines(id), lot_id uuid not null references public.lots(id),
  quantity numeric(14,3) not null check(quantity > 0), movement_id uuid not null unique references public.stock_movements(id)
);
create table public.sales_returns (
  id uuid primary key default gen_random_uuid(), shipment_line_id uuid not null references public.sales_shipment_lines(id),
  quantity numeric(14,3) not null check(quantity > 0), movement_id uuid unique references public.stock_movements(id),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.time_entries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  kind text not null check(kind in ('start','pause','resume','end')), occurred_at timestamptz not null,
  notes text not null default '', correction_of uuid references public.time_entries(id),
  created_at timestamptz not null default now()
);
create index time_entries_user_idx on public.time_entries(user_id,occurred_at desc);

alter table public.stock_movements add column compensation_of uuid unique references public.stock_movements(id),
  add column inventory_count_id uuid references public.inventory_counts(id);
alter table public.stock_movements drop constraint stock_movements_kind_check,
  drop constraint stock_movements_quantity_kind_check;
alter table public.stock_movements add constraint stock_movements_kind_check check(kind in
  ('receipt','dispatch','external_dispatch','loss','note','production_input','production_output','inventory_adjustment','compensation','order_dispatch','sales_return')),
  add constraint stock_movements_quantity_kind_check check(
    (kind in ('receipt','production_output','sales_return') and quantity > 0)
    or (kind in ('dispatch','external_dispatch','loss','production_input','order_dispatch') and quantity < 0)
    or (kind in ('inventory_adjustment','compensation') and quantity <> 0)
    or (kind = 'note' and quantity = 0));

create function private.operations_role() returns text language sql stable security definer set search_path = '' as $$
  select role from public.staff_members where user_id = auth.uid() and active;
$$;
create function private.operations_text(p_data jsonb,p_key text,p_min integer default 1,p_max integer default 240)
returns text language plpgsql immutable set search_path = '' as $$
declare v text := trim(p_data->>p_key);
begin
  if v is null or length(v) not between p_min and p_max then raise exception 'Campo inválido: %.',p_key; end if;
  return v;
end; $$;
create function private.operations_number(p_data jsonb,p_key text,p_scale integer,p_min numeric default 0,p_max numeric default 999999999)
returns numeric language plpgsql immutable set search_path = '' as $$
declare v numeric := (p_data->>p_key)::numeric;
begin
  if v is null or v::text in ('NaN','Infinity','-Infinity') or v < p_min or v > p_max or v <> round(v,p_scale)
    then raise exception 'Valor inválido: %.',p_key; end if;
  return v;
end; $$;
create function private.operations_immutable() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Histórico imutável; registre um evento compensatório.'; end; $$;

-- No direct Data API writes or reads: snapshots use authorization and explicit projections.
do $$ declare t text; begin
  foreach t in array array['operations_commands','inventory_counts','inventory_count_lines','inspection_templates','receipt_inspections',
    'private_attachments','alert_rules','temperature_readings','operational_alerts','financial_accounts','financial_titles',
    'financial_settlements','financial_reconciliations','sales_customers','sales_catalog','sales_orders','sales_order_lines',
    'stock_reservations','sales_shipments','sales_shipment_lines','sales_returns','time_entries'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
  end loop;
  foreach t in array array['operations_commands','inspection_templates','receipt_inspections','private_attachments',
    'temperature_readings','financial_titles','financial_settlements','financial_reconciliations','sales_order_lines',
    'sales_shipments','sales_shipment_lines','sales_returns','time_entries','audit_events','stock_movements'] loop
    execute format('create trigger immutable_operations_history before update or delete on public.%I for each row execute function private.operations_immutable()',t);
  end loop;
end $$;

-- Legacy consumers lock lots too. This invariant protects reservations even when
-- an older receipt/production/loss RPC updates the physical balance.
create function private.protect_reserved_stock() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.quantity < coalesce((select sum(quantity) from public.stock_reservations where lot_id = new.id and status = 'active'),0)
    then raise exception 'Saldo comprometido por reservas comerciais.'; end if;
  return new;
end; $$;
create trigger protect_reserved_stock before update of quantity on public.lots
for each row execute function private.protect_reserved_stock();

create function private.operations_command(p_command_id uuid,p_module text,p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_role text := private.operations_role(); v_name text;
  v_existing public.operations_commands; v_result jsonb; v_before jsonb; v_after jsonb; v_id uuid := gen_random_uuid();
  v_reason text; v_data jsonb := coalesce(p_data,'{}'); v_item jsonb; v_criteria jsonb; v_keys text[];
  v_count public.inventory_counts; v_line public.inventory_count_lines; v_lot public.lots;
  v_movement public.stock_movements; v_template public.inspection_templates; v_staff public.staff_members;
  v_rule public.alert_rules; v_reading public.temperature_readings;
  v_title public.financial_titles; v_settlement public.financial_settlements;
  v_order public.sales_orders; v_catalog public.sales_catalog; v_order_line public.sales_order_lines;
  v_reservation public.stock_reservations; v_shipment_line public.sales_shipment_lines; v_entry public.time_entries;
  v_quantity numeric; v_amount numeric; v_delta numeric; v_total numeric; v_paid numeric; v_object jsonb;
  v_ref uuid; v_source uuid; v_text text; v_date timestamptz; v_revision integer;
begin
  if v_actor is null or v_role is null then raise exception 'Acesso não autorizado.' using errcode = '42501'; end if;
  if p_module is null or p_module not in ('inventory','receiving','staff','alerts','finance','commercial','time')
    then raise exception 'Módulo inválido.'; end if;
  if (p_module in ('inventory','receiving','finance','commercial') and v_role <> 'admin')
    or (p_module in ('staff','alerts') and v_role not in ('admin','manager'))
    then raise exception 'Acesso não autorizado ao módulo.' using errcode = '42501'; end if;
  if p_command_id is null or p_action is null or jsonb_typeof(v_data) <> 'object' or octet_length(v_data::text) > 65536
    then raise exception 'Comando inválido.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('operations:' || p_command_id::text,0));
  select * into v_existing from public.operations_commands where id = p_command_id;
  if found then
    if v_existing.actor_id <> v_actor or v_existing.module <> p_module or v_existing.action <> p_action
      or v_existing.fingerprint <> md5(v_data::text) then raise exception 'Identificador reutilizado para outro comando.'; end if;
    return v_existing.result;
  end if;
  select display_name into v_name from public.staff_members where user_id = v_actor;
  v_reason := case when p_module = 'time' and p_action = 'record' then 'Apontamento operacional próprio'
    when p_module = 'inventory' and p_action = 'count_line' then 'Registro de contagem física'
    else private.operations_text(v_data,'reason',3,240) end;

  if p_module = 'inventory' then
    if p_action = 'count_open' then
      perform 1 from public.storage_locations where id = (v_data->>'location_id')::uuid and active for share;
      if not found then raise exception 'Local indisponível.'; end if;
      insert into public.inventory_counts(id,location_id,reason,created_by)
        values(v_id,(v_data->>'location_id')::uuid,v_reason,v_actor);
    elsif p_action in ('count_line','count_approve') then
      select * into v_count from public.inventory_counts where id = (v_data->>'session_id')::uuid for update;
      if not found or v_count.status <> 'open' then raise exception 'Contagem indisponível.'; end if;
      perform 1 from public.storage_locations where id = v_count.location_id and active for share;
      if not found then raise exception 'Local arquivado.'; end if;
      v_id := v_count.id;
      if p_action = 'count_line' then
        v_quantity := private.operations_number(v_data,'counted_quantity',3);
        select * into v_lot from public.lots where id = (v_data->>'lot_id')::uuid and location_id = v_count.location_id for update;
        if not found then raise exception 'Lote não pertence ao local.'; end if;
        if v_lot.unit in ('un','pct','cx') and v_quantity <> trunc(v_quantity) then raise exception 'Unidade exige quantidade inteira.'; end if;
        insert into public.inventory_count_lines(session_id,lot_id,expected_quantity,counted_quantity,counted_by)
          values(v_id,v_lot.id,v_lot.quantity,v_quantity,v_actor)
          on conflict(session_id,lot_id) do update set expected_quantity = excluded.expected_quantity,
            counted_quantity = excluded.counted_quantity,counted_by = excluded.counted_by,created_at = now();
      else
        if not exists(select 1 from public.inventory_count_lines where session_id = v_id) then raise exception 'Contagem sem linhas.'; end if;
        if exists(select 1 from public.inventory_count_lines where session_id = v_id and counted_by = v_actor and counted_quantity <> expected_quantity)
          then raise exception 'Diferenças exigem outro aprovador.'; end if;
        perform 1 from public.lots where id in (select lot_id from public.inventory_count_lines where session_id = v_id) order by id for update;
        for v_line in select * from public.inventory_count_lines where session_id = v_id order by lot_id loop
          select * into v_lot from public.lots where id = v_line.lot_id;
          if v_lot.quantity <> v_line.expected_quantity then raise exception 'Saldo mudou após a contagem; reconte o lote.'; end if;
          v_delta := v_line.counted_quantity - v_lot.quantity;
          if v_delta <> 0 then
            update public.lots set quantity = v_line.counted_quantity where id = v_lot.id;
            insert into public.stock_movements(request_id,lot_id,kind,quantity,balance_after,reason,operated_at,actor_name,inventory_count_id)
              values(gen_random_uuid(),v_lot.id,'inventory_adjustment',v_delta,v_line.counted_quantity,v_reason,now(),v_name,v_id);
          end if;
        end loop;
        update public.inventory_counts set status = 'approved',approved_by = v_actor,approved_at = now() where id = v_id;
      end if;
    elsif p_action = 'compensate' then
      select * into v_movement from public.stock_movements where id = (v_data->>'movement_id')::uuid;
      if not found or v_movement.kind not in ('external_dispatch','loss','inventory_adjustment')
        then raise exception 'Movimento exige correção específica; compensação não permitida.'; end if;
      select * into v_lot from public.lots where id = v_movement.lot_id for update;
      perform 1 from public.storage_locations where id = v_lot.location_id and active;
      if not found then raise exception 'Local arquivado.'; end if;
      v_delta := -v_movement.quantity;
      update public.lots set quantity = quantity + v_delta where id = v_lot.id;
      insert into public.stock_movements(id,request_id,lot_id,kind,quantity,balance_after,reason,operated_at,actor_name,compensation_of)
        values(v_id,p_command_id,v_lot.id,'compensation',v_delta,v_lot.quantity+v_delta,v_reason,now(),v_name,v_movement.id);
    else raise exception 'Ação de inventário inválida.'; end if;

  elsif p_module = 'receiving' then
    if p_action = 'template_create' then
      v_text := private.operations_text(v_data,'name',2,120); v_criteria := v_data->'criteria';
      if jsonb_typeof(v_criteria) is distinct from 'array' or jsonb_array_length(v_criteria) not between 1 and 40 then raise exception 'Critérios inválidos.'; end if;
      v_keys := array[]::text[];
      for v_item in select value from jsonb_array_elements(v_criteria) loop
        v_text := private.operations_text(v_item,'key',1,50);
        if v_text !~ '^[a-z][a-z0-9_]*$' or v_text = any(v_keys) or coalesce(v_item->>'type','') not in ('boolean','number','text')
          or jsonb_typeof(v_item->'required') is distinct from 'boolean' then raise exception 'Critério inválido ou duplicado.'; end if;
        perform private.operations_text(v_item,'label',2,200); v_keys := array_append(v_keys,v_text);
      end loop;
      v_text := trim(v_data->>'name');
      perform pg_advisory_xact_lock(hashtextextended('inspection:' || v_text,0));
      select coalesce(max(revision),0)+1 into v_revision from public.inspection_templates where name = v_text;
      insert into public.inspection_templates(id,name,revision,criteria,created_by) values(v_id,v_text,v_revision,v_criteria,v_actor);
    elsif p_action = 'inspect' then
      perform 1 from public.receipts where id = (v_data->>'receipt_id')::uuid;
      if not found then raise exception 'Recebimento não encontrado.'; end if;
      select * into v_template from public.inspection_templates where id = (v_data->>'template_id')::uuid;
      if not found or jsonb_typeof(v_data->'responses') is distinct from 'object' then raise exception 'Checklist inválido.'; end if;
      for v_item in select value from jsonb_array_elements(v_template.criteria) loop
        v_text := v_item->>'key';
        if (v_item->>'required')::boolean and (not ((v_data->'responses') ? v_text) or v_data->'responses'->v_text = 'null'::jsonb)
          then raise exception 'Critério obrigatório ausente: %.',v_text; end if;
        if (v_data->'responses') ? v_text and jsonb_typeof(v_data->'responses'->v_text) is distinct from
          (case when v_item->>'type'='text' then 'string' else v_item->>'type' end)
          then raise exception 'Tipo inválido no critério: %.',v_text; end if;
        if v_item->>'type'='text' and length(coalesce(v_data->'responses'->>v_text,''))>1000 then raise exception 'Resposta muito longa.'; end if;
      end loop;
      if exists(select 1 from jsonb_object_keys(v_data->'responses') k where not exists
        (select 1 from jsonb_array_elements(v_template.criteria) c where c->>'key' = k)) then raise exception 'Critério desconhecido.'; end if;
      insert into public.receipt_inspections(id,receipt_id,template_id,decision,responses,notes,created_by)
        values(v_id,(v_data->>'receipt_id')::uuid,v_template.id,v_data->>'decision',v_data->'responses',coalesce(v_data->>'notes',''),v_actor);
    elsif p_action = 'attachment_register' then
      v_ref := (v_data->>'receipt_id')::uuid; v_text := private.operations_text(v_data,'object_name',1,500);
      if v_text !~ ('^' || v_ref::text || '/' || v_actor::text || '/[a-f0-9-]{36}\.(pdf|png|jpg|jpeg)$')
        then raise exception 'Caminho do arquivo não autorizado.'; end if;
      v_quantity := private.operations_number(v_data,'size_bytes',0,1,10485760);
      if to_regclass('storage.objects') is null then raise exception 'Storage privado não disponível; upload não registrado.'; end if;
      execute 'select to_jsonb(o) from storage.objects o where bucket_id = $1 and name = $2' into v_object using 'frutalize-receipts',v_text;
      if v_object is null or coalesce(v_object->>'owner_id',v_object->>'owner') is distinct from v_actor::text
        or (v_object->'metadata'->>'size')::bigint is distinct from v_quantity::bigint
        or v_object->'metadata'->>'mimetype' is distinct from v_data->>'mime_type'
        then raise exception 'Arquivo ausente, metadados divergentes ou proprietário inválido.'; end if;
      insert into public.private_attachments(id,receipt_id,object_name,mime_type,size_bytes,created_by)
        values(v_id,v_ref,v_text,v_data->>'mime_type',v_quantity,v_actor);
    else raise exception 'Ação de recebimento inválida.'; end if;

  elsif p_module = 'staff' then
    perform pg_advisory_xact_lock(hashtextextended('staff-permissions',0));
    v_id := (v_data->>'user_id')::uuid;
    select * into v_staff from public.staff_members where user_id = v_id for update;
    v_before := case when found then jsonb_build_object('user_id',v_staff.user_id,'display_name',v_staff.display_name,'role',v_staff.role,'active',v_staff.active) else null end;
    if p_action = 'save' then
      v_text := private.operations_text(v_data,'display_name',2,120);
      if v_role = 'manager' and (v_data->>'role' not in ('manager','collaborator') or v_staff.user_id is not null)
        then raise exception 'Gestor só cadastra novos gestores e colaboradores.' using errcode = '42501'; end if;
      if not exists(select 1 from auth.users where id = v_id) then raise exception 'Usuário Auth existente obrigatório; envie convite pelo servidor.'; end if;
      if v_staff.role = 'admin' and v_data->>'role' <> 'admin' and v_staff.active
        and (select count(*) from public.staff_members where active and role = 'admin') <= 1 then raise exception 'Preserve pelo menos um administrador ativo.'; end if;
      insert into public.staff_members(user_id,display_name,role) values(v_id,v_text,v_data->>'role')
        on conflict(user_id) do update set display_name = excluded.display_name,role = excluded.role;
    elsif p_action in ('block','reactivate') then
      if v_staff.user_id is null then raise exception 'Membro não encontrado.'; end if;
      if v_role = 'manager' and v_staff.role <> 'collaborator' then raise exception 'Gestor só bloqueia ou reativa colaborador.' using errcode = '42501'; end if;
      if p_action = 'block' and v_staff.role = 'admin' and v_staff.active
        and (select count(*) from public.staff_members where active and role = 'admin') <= 1 then raise exception 'Preserve pelo menos um administrador ativo.'; end if;
      update public.staff_members set active = (p_action = 'reactivate') where user_id = v_id;
    else raise exception 'Ação de equipe inválida.'; end if;

  elsif p_module = 'alerts' then
    if p_action = 'rule_save' then
      v_id := coalesce(nullif(v_data->>'id','')::uuid,v_id); v_text := private.operations_text(v_data,'name',2,120);
      if v_data->>'kind' = 'minimum_stock' then
        if nullif(v_data->>'variant_id','') is null then raise exception 'Apresentação obrigatória.'; end if;
        v_quantity := private.operations_number(v_data,'threshold',3);
      elsif v_data->>'kind' in ('expiry','missing_reading') then
        v_quantity := private.operations_number(v_data,'threshold',0,1,8760);
      elsif v_data->>'kind' = 'temperature' then
        v_quantity := private.operations_number(v_data,'lower_limit',3,-150,150);
        v_amount := private.operations_number(v_data,'upper_limit',3,-150,150);
        if v_quantity >= v_amount then raise exception 'Intervalo de temperatura inválido.'; end if;
      else raise exception 'Regra inválida.'; end if;
      if v_data->>'kind' in ('temperature','missing_reading') and nullif(v_data->>'location_id','') is null then raise exception 'Local obrigatório.'; end if;
      select to_jsonb(r) into v_before from public.alert_rules r where id = v_id for update;
      insert into public.alert_rules(id,name,kind,variant_id,category_id,location_id,threshold,lower_limit,upper_limit,active,created_by)
        values(v_id,v_text,v_data->>'kind',nullif(v_data->>'variant_id','')::uuid,nullif(v_data->>'category_id','')::uuid,
          nullif(v_data->>'location_id','')::uuid,nullif(v_data->>'threshold','')::numeric,nullif(v_data->>'lower_limit','')::numeric,
          nullif(v_data->>'upper_limit','')::numeric,(v_data->>'active')::boolean,v_actor)
        on conflict(id) do update set name = excluded.name,kind = excluded.kind,variant_id = excluded.variant_id,
          category_id = excluded.category_id,location_id = excluded.location_id,threshold = excluded.threshold,
          lower_limit = excluded.lower_limit,upper_limit = excluded.upper_limit,active = excluded.active;
    elsif p_action = 'reading_record' then
      v_quantity := private.operations_number(v_data,'value_c',3,-150,150); v_date := (v_data->>'measured_at')::timestamptz;
      if v_date is null or v_date > now() or v_date < now()-interval '7 days' then raise exception 'Horário de leitura inválido.'; end if;
      perform 1 from public.storage_locations where id = (v_data->>'location_id')::uuid and active;
      if not found then raise exception 'Local indisponível.'; end if;
      insert into public.temperature_readings(id,location_id,value_c,measured_at,equipment,created_by)
        values(v_id,(v_data->>'location_id')::uuid,v_quantity,v_date,private.operations_text(v_data,'equipment',2,120),v_actor);
    elsif p_action = 'evaluate' then
      perform pg_advisory_xact_lock(hashtextextended('alert-evaluation',0));
      for v_rule in select * from public.alert_rules where active order by id for update loop
        v_keys := array[]::text[];
        if v_rule.kind = 'minimum_stock' then
          select coalesce(sum(l.quantity),0) into v_quantity from public.lots l join public.storage_locations s on s.id = l.location_id
            join public.item_variants iv on iv.id = l.variant_id join public.products p on p.id = iv.product_id join public.categories c on c.id = p.category_id
            where s.active and iv.active and p.active and c.active and l.variant_id = v_rule.variant_id
              and (v_rule.location_id is null or l.location_id = v_rule.location_id)
              and (l.expires_on is null or l.expires_on >= current_date);
          -- Never add incompatible units for the same variant.
          if (select count(distinct l.unit) from public.lots l join public.storage_locations s on s.id=l.location_id
            where l.variant_id=v_rule.variant_id and l.quantity>0 and s.active and (v_rule.location_id is null or l.location_id=v_rule.location_id)) > 1
            then raise exception 'Estoque mínimo exige unidade homogênea por apresentação/local.'; end if;
          if v_quantity < v_rule.threshold then
            v_keys := array_append(v_keys,'stock:' || current_date::text);
            insert into public.operational_alerts(rule_id,event_key,details) values(v_rule.id,v_keys[1],jsonb_build_object('quantity',v_quantity,'threshold',v_rule.threshold)) on conflict do nothing;
          end if;
        elsif v_rule.kind = 'expiry' then
          for v_lot in select l.* from public.lots l join public.storage_locations s on s.id=l.location_id
            join public.item_variants iv on iv.id=l.variant_id join public.products p on p.id=iv.product_id
            where l.quantity>0 and s.active and iv.active and p.active and l.expires_on <= current_date + v_rule.threshold::integer
              and (v_rule.category_id is null or p.category_id=v_rule.category_id) and (v_rule.location_id is null or l.location_id=v_rule.location_id) loop
            v_text := 'expiry:' || v_lot.id::text; v_keys := array_append(v_keys,v_text);
            insert into public.operational_alerts(rule_id,event_key,details) values(v_rule.id,v_text,jsonb_build_object('lot_id',v_lot.id,'lot_code',v_lot.code,'expires_on',v_lot.expires_on)) on conflict do nothing;
          end loop;
        else
          select * into v_reading from public.temperature_readings where location_id=v_rule.location_id order by measured_at desc,created_at desc limit 1;
          if (v_rule.kind='missing_reading' and (v_reading.id is null or v_reading.measured_at < now()-make_interval(hours=>v_rule.threshold::integer)))
            or (v_rule.kind='temperature' and v_reading.id is not null and (v_reading.value_c < v_rule.lower_limit or v_reading.value_c > v_rule.upper_limit)) then
            v_text := v_rule.kind || ':' || coalesce(v_reading.id::text,current_date::text); v_keys := array_append(v_keys,v_text);
            insert into public.operational_alerts(rule_id,event_key,details) values(v_rule.id,v_text,
              jsonb_build_object('location_id',v_rule.location_id,'value_c',v_reading.value_c,'measured_at',v_reading.measured_at,'equipment',v_reading.equipment)) on conflict do nothing;
          end if;
        end if;
        update public.operational_alerts set status='resolved',resolved_at=now(),resolved_by=v_actor,resolution='Condição deixou de ocorrer na avaliação'
          where rule_id=v_rule.id and status='open' and not (event_key = any(v_keys));
      end loop;
    elsif p_action = 'resolve' then
      v_id := (v_data->>'id')::uuid;
      update public.operational_alerts set status='resolved',resolved_at=now(),resolved_by=v_actor,resolution=v_reason where id=v_id and status='open';
      if not found then raise exception 'Alerta aberto não encontrado.'; end if;
    else raise exception 'Ação de alertas inválida.'; end if;

  elsif p_module = 'finance' then
    if p_action = 'account_create' then
      insert into public.financial_accounts(id,name,kind,created_by) values(v_id,private.operations_text(v_data,'name',2,120),v_data->>'kind',v_actor);
    elsif p_action = 'title_create' then
      v_amount := private.operations_number(v_data,'amount',2,0.01); v_source := nullif(v_data->>'source_id','')::uuid;
      if v_source is not null then
        perform pg_advisory_xact_lock(hashtextextended('financial-source:' || (v_data->>'source_type') || ':' || v_source::text,0));
        if exists(select 1 from public.financial_titles where source_type=v_data->>'source_type' and source_id=v_source)
          then raise exception 'Origem já vinculada a título financeiro.'; end if;
        if v_data->>'source_type'='receipt' then
          select total_cost into v_total from public.receipts where id=v_source;
          if not found or v_data->>'kind'<>'payable' or v_total<>v_amount then raise exception 'Custo/origem de recebimento inválido.'; end if;
        elsif v_data->>'source_type'='production' then
          perform 1 from public.production_runs where id=v_source;
          if not found or v_data->>'kind'<>'payable' then raise exception 'Origem de produção inválida.'; end if;
        elsif v_data->>'source_type'='order' then
          select sum(quantity*unit_price) into v_total from public.sales_order_lines where order_id=v_source;
          if v_total is null or v_data->>'kind'<>'receivable' or round(v_total,2)<>v_amount then raise exception 'Valor/origem de pedido inválido.'; end if;
        else raise exception 'Origem inválida.'; end if;
      end if;
      if (v_data->>'competence_on')::date is null or (v_data->>'due_on')::date is null then raise exception 'Datas financeiras obrigatórias.'; end if;
      insert into public.financial_titles(id,kind,description,amount,competence_on,due_on,source_type,source_id,created_by)
        values(v_id,v_data->>'kind',private.operations_text(v_data,'description',3,240),v_amount,(v_data->>'competence_on')::date,
          (v_data->>'due_on')::date,nullif(v_data->>'source_type',''),v_source,v_actor);
    elsif p_action = 'settle' then
      select * into v_title from public.financial_titles where id=(v_data->>'title_id')::uuid for update;
      if not found then raise exception 'Título não encontrado.'; end if;
      v_amount:=private.operations_number(v_data,'amount',2,0.01);
      select coalesce(sum(case when reversal_of is null then amount else -amount end),0) into v_paid from public.financial_settlements where title_id=v_title.id;
      if v_amount>v_title.amount-v_paid then raise exception 'Baixa excede saldo em aberto.'; end if;
      perform 1 from public.financial_accounts where id=(v_data->>'account_id')::uuid and active;
      if not found then raise exception 'Conta indisponível.'; end if;
      if (v_data->>'paid_on')::date is null or (v_data->>'paid_on')::date>current_date then raise exception 'Data de baixa inválida.'; end if;
      insert into public.financial_settlements(id,title_id,account_id,amount,paid_on,created_by)
        values(v_id,v_title.id,(v_data->>'account_id')::uuid,v_amount,(v_data->>'paid_on')::date,v_actor);
    elsif p_action in ('reverse','reconcile') then
      select * into v_settlement from public.financial_settlements where id=(v_data->>'settlement_id')::uuid;
      if not found or v_settlement.reversal_of is not null then raise exception 'Baixa original não encontrada.'; end if;
      perform 1 from public.financial_titles where id=v_settlement.title_id for update;
      if exists(select 1 from public.financial_settlements where reversal_of=v_settlement.id) then raise exception 'Baixa já estornada.'; end if;
      if p_action='reverse' then
        insert into public.financial_settlements(id,title_id,account_id,amount,paid_on,reversal_of,created_by)
          values(v_id,v_settlement.title_id,v_settlement.account_id,v_settlement.amount,current_date,v_settlement.id,v_actor);
      else
        insert into public.financial_reconciliations(id,settlement_id,account_id,external_reference,created_by)
          values(v_id,v_settlement.id,v_settlement.account_id,private.operations_text(v_data,'external_reference',1,120),v_actor);
      end if;
    else raise exception 'Ação financeira inválida.'; end if;

  elsif p_module = 'commercial' then
    if p_action='customer_create' then
      insert into public.sales_customers(id,name,user_id,created_by) values(v_id,private.operations_text(v_data,'name',2,120),nullif(v_data->>'user_id','')::uuid,v_actor);
    elsif p_action='catalog_save' then
      v_id:=coalesce(nullif(v_data->>'id','')::uuid,v_id); v_amount:=private.operations_number(v_data,'price',2);
      perform 1 from public.item_variants iv join public.products p on p.id=iv.product_id join public.categories c on c.id=p.category_id
        where iv.id=(v_data->>'variant_id')::uuid and iv.active and p.active and c.active;
      if not found then raise exception 'Apresentação indisponível.'; end if;
      select to_jsonb(c) into v_before from public.sales_catalog c where id=v_id for update;
      insert into public.sales_catalog(id,variant_id,name,unit,price,active,created_by)
        values(v_id,(v_data->>'variant_id')::uuid,private.operations_text(v_data,'name',2,120),v_data->>'unit',v_amount,(v_data->>'active')::boolean,v_actor)
        on conflict(id) do update set variant_id=excluded.variant_id,name=excluded.name,unit=excluded.unit,price=excluded.price,active=excluded.active;
    elsif p_action='order_create' then
      if jsonb_typeof(v_data->'items') is distinct from 'array' or jsonb_array_length(v_data->'items') not between 1 and 50 then raise exception 'Itens obrigatórios.'; end if;
      insert into public.sales_orders(id,customer_id,created_by) values(v_id,(v_data->>'customer_id')::uuid,v_actor);
      for v_item in select value from jsonb_array_elements(v_data->'items') loop
        select * into v_catalog from public.sales_catalog where id=(v_item->>'catalog_id')::uuid and active for share;
        if not found then raise exception 'Item comercial indisponível.'; end if;
        v_quantity:=private.operations_number(v_item,'quantity',3,0.001);
        if v_catalog.unit in ('un','pct','cx') and v_quantity<>trunc(v_quantity) then raise exception 'Quantidade exige número inteiro.'; end if;
        insert into public.sales_order_lines(order_id,catalog_id,variant_id,description,unit,quantity,unit_price)
          values(v_id,v_catalog.id,v_catalog.variant_id,v_catalog.name,v_catalog.unit,v_quantity,v_catalog.price);
      end loop;
    elsif p_action in ('reserve','cancel','ship') then
      select * into v_order from public.sales_orders where id=(v_data->>'order_id')::uuid for update;
      if not found then raise exception 'Pedido não encontrado.'; end if;
      v_id:=v_order.id; v_before:=to_jsonb(v_order);
      if p_action='reserve' then
        if v_order.status<>'open' or jsonb_typeof(v_data->'allocations') is distinct from 'array' or jsonb_array_length(v_data->'allocations') not between 1 and 100
          then raise exception 'Pedido ou alocações indisponíveis.'; end if;
        perform 1 from public.lots where id in (select (value->>'lot_id')::uuid from jsonb_array_elements(v_data->'allocations')) order by id for update;
        for v_item in select value from jsonb_array_elements(v_data->'allocations') loop
          select * into v_order_line from public.sales_order_lines where id=(v_item->>'line_id')::uuid and order_id=v_id;
          select * into v_lot from public.lots where id=(v_item->>'lot_id')::uuid;
          if v_order_line.id is null or v_lot.id is null or v_lot.variant_id<>v_order_line.variant_id or v_lot.unit<>v_order_line.unit
            or (v_lot.expires_on is not null and v_lot.expires_on<current_date) then raise exception 'Lote incompatível ou vencido.'; end if;
          perform 1 from public.storage_locations s join public.item_variants iv on iv.id=v_lot.variant_id join public.products p on p.id=iv.product_id
            join public.categories c on c.id=p.category_id where s.id=v_lot.location_id and s.active and iv.active and p.active and c.active;
          if not found then raise exception 'Estoque arquivado indisponível.'; end if;
          v_quantity:=private.operations_number(v_item,'quantity',3,0.001);
          if v_lot.unit in ('un','pct','cx') and v_quantity<>trunc(v_quantity) then raise exception 'Quantidade exige número inteiro.'; end if;
          select coalesce(sum(quantity),0) into v_total from public.stock_reservations where lot_id=v_lot.id and status='active';
          if v_quantity>v_lot.quantity-v_total then raise exception 'Saldo disponível insuficiente para reserva.'; end if;
          insert into public.stock_reservations(order_id,line_id,lot_id,quantity) values(v_id,v_order_line.id,v_lot.id,v_quantity);
        end loop;
        if exists(select 1 from public.sales_order_lines l where l.order_id=v_id and l.quantity<>(select coalesce(sum(r.quantity),0) from public.stock_reservations r where r.line_id=l.id and r.status='active'))
          then raise exception 'Reserva deve cobrir exatamente todas as linhas.'; end if;
        update public.sales_orders set status='reserved' where id=v_id;
      elsif p_action='cancel' then
        if v_order.status not in ('open','reserved') then raise exception 'Pedido não pode ser cancelado.'; end if;
        perform 1 from public.lots where id in (select lot_id from public.stock_reservations where order_id=v_id and status='active') order by id for update;
        update public.stock_reservations set status='released' where order_id=v_id and status='active';
        update public.sales_orders set status='cancelled' where id=v_id;
      else
        if v_order.status<>'reserved' then raise exception 'Pedido deve estar reservado.'; end if;
        perform 1 from public.lots where id in (select lot_id from public.stock_reservations where order_id=v_id and status='active') order by id for update;
        v_ref:=gen_random_uuid();
        insert into public.sales_shipments(id,order_id,shipped_by) values(v_ref,v_id,v_actor);
        -- Release these logical claims before physical debit; claims of other orders remain protected by trigger.
        update public.stock_reservations set status='shipped' where order_id=v_id and status='active';
        for v_reservation in select * from public.stock_reservations where order_id=v_id and status='shipped' order by lot_id,id loop
          select * into v_lot from public.lots where id=v_reservation.lot_id;
          perform 1 from public.storage_locations s join public.item_variants iv on iv.id=v_lot.variant_id
            join public.products p on p.id=iv.product_id join public.categories c on c.id=p.category_id
            where s.id=v_lot.location_id and s.active and iv.active and p.active and c.active;
          if not found or (v_lot.expires_on is not null and v_lot.expires_on<current_date) then raise exception 'Lote vencido ou cadastro arquivado.'; end if;
          update public.lots set quantity=quantity-v_reservation.quantity where id=v_lot.id;
          v_source:=gen_random_uuid();
          insert into public.stock_movements(id,request_id,lot_id,kind,quantity,balance_after,reason,operated_at,actor_name)
            values(v_source,gen_random_uuid(),v_lot.id,'order_dispatch',-v_reservation.quantity,v_lot.quantity-v_reservation.quantity,v_reason,now(),v_name);
          insert into public.sales_shipment_lines(shipment_id,reservation_id,line_id,lot_id,quantity,movement_id)
            values(v_ref,v_reservation.id,v_reservation.line_id,v_lot.id,v_reservation.quantity,v_source);
        end loop;
        update public.sales_orders set status='shipped' where id=v_id;
      end if;
    elsif p_action='return' then
      select * into v_shipment_line from public.sales_shipment_lines where id=(v_data->>'shipment_line_id')::uuid;
      if not found then raise exception 'Linha expedida não encontrada.'; end if;
      select * into v_lot from public.lots where id=v_shipment_line.lot_id for update;
      select coalesce(sum(quantity),0) into v_total from public.sales_returns where shipment_line_id=v_shipment_line.id;
      v_quantity:=private.operations_number(v_data,'quantity',3,0.001);
      if v_lot.unit in ('un','pct','cx') and v_quantity<>trunc(v_quantity) then raise exception 'Quantidade exige número inteiro.'; end if;
      if v_quantity>v_shipment_line.quantity-v_total then raise exception 'Devolução excede quantidade expedida.'; end if;
      -- Product returned by a customer remains segregated until a responsible
      -- technician decides its destination. This does not restore stock.
      insert into public.sales_returns(id,shipment_line_id,quantity,movement_id,created_by)
        values(v_id,v_shipment_line.id,v_quantity,null,v_actor);
    else raise exception 'Ação comercial inválida.'; end if;

  elsif p_module = 'time' then
    perform pg_advisory_xact_lock(hashtextextended('time:'||v_actor::text,0));
    v_date:=(v_data->>'occurred_at')::timestamptz;
    if v_date is null or v_date>now() or v_date<now()-interval '30 days' then raise exception 'Horário de apontamento inválido.'; end if;
    if p_action='record' then
      select * into v_entry from public.time_entries e where user_id=v_actor and correction_of is null order by created_at desc,id desc limit 1;
      if (v_entry.id is null and v_data->>'kind'<>'start') or
        (v_entry.kind='end' and v_data->>'kind'<>'start') or
        (v_entry.kind in ('start','resume') and v_data->>'kind' not in ('pause','end')) or
        (v_entry.kind='pause' and v_data->>'kind' not in ('resume','end')) then raise exception 'Sequência de apontamento inválida.'; end if;
      if v_entry.id is not null and v_date<=v_entry.occurred_at then raise exception 'Horário deve avançar.'; end if;
      insert into public.time_entries(id,user_id,kind,occurred_at,notes) values(v_id,v_actor,v_data->>'kind',v_date,left(coalesce(v_data->>'notes',''),1000));
    elsif p_action='correct' then
      select * into v_entry from public.time_entries where id=(v_data->>'entry_id')::uuid and user_id=v_actor and correction_of is null;
      if not found then raise exception 'Apontamento próprio não encontrado.'; end if;
      insert into public.time_entries(id,user_id,kind,occurred_at,notes,correction_of) values(v_id,v_actor,v_entry.kind,v_date,v_reason,v_entry.id);
    else raise exception 'Ação de apontamento inválida.'; end if;
  end if;
  -- Store concrete before/after evidence, never arbitrary extra client keys,
  -- Auth metadata, passwords or operational PIN hashes.
  if p_module='inventory' then
    if p_action='compensate' then select to_jsonb(m) into v_after from public.stock_movements m where id=v_id;
    else select to_jsonb(c)||jsonb_build_object('lines',coalesce((select jsonb_agg(to_jsonb(l)) from public.inventory_count_lines l where session_id=c.id),'[]'::jsonb))
      into v_after from public.inventory_counts c where c.id=v_id; end if;
  elsif p_module='receiving' then
    if p_action='template_create' then select to_jsonb(x) into v_after from public.inspection_templates x where id=v_id;
    elsif p_action='inspect' then select to_jsonb(x) into v_after from public.receipt_inspections x where id=v_id;
    else select to_jsonb(x) into v_after from public.private_attachments x where id=v_id; end if;
  elsif p_module='staff' then
    select jsonb_build_object('user_id',user_id,'display_name',display_name,'role',role,'active',active) into v_after from public.staff_members where user_id=v_id;
  elsif p_module='alerts' then
    if p_action='rule_save' then select to_jsonb(x) into v_after from public.alert_rules x where id=v_id;
    elsif p_action='reading_record' then select to_jsonb(x) into v_after from public.temperature_readings x where id=v_id;
    elsif p_action='resolve' then select to_jsonb(x) into v_after from public.operational_alerts x where id=v_id;
    else select jsonb_build_object('open_count',count(*)) into v_after from public.operational_alerts where status='open'; end if;
  elsif p_module='finance' then
    if p_action='account_create' then select to_jsonb(x) into v_after from public.financial_accounts x where id=v_id;
    elsif p_action='title_create' then select to_jsonb(x) into v_after from public.financial_titles x where id=v_id;
    elsif p_action='reconcile' then select to_jsonb(x) into v_after from public.financial_reconciliations x where id=v_id;
    else select to_jsonb(x) into v_after from public.financial_settlements x where id=v_id; end if;
  elsif p_module='commercial' then
    if p_action='customer_create' then select to_jsonb(x) into v_after from public.sales_customers x where id=v_id;
    elsif p_action='catalog_save' then select to_jsonb(x) into v_after from public.sales_catalog x where id=v_id;
    elsif p_action='return' then select to_jsonb(x) into v_after from public.sales_returns x where id=v_id;
    else select to_jsonb(x)||jsonb_build_object('lines',coalesce((select jsonb_agg(to_jsonb(l)) from public.sales_order_lines l where order_id=x.id),'[]'::jsonb))
      into v_after from public.sales_orders x where id=v_id; end if;
  else select to_jsonb(x) into v_after from public.time_entries x where id=v_id; end if;
  v_result:=jsonb_build_object('ok',true,'id',v_id);
  insert into public.operations_commands(id,actor_id,module,action,fingerprint,result) values(p_command_id,v_actor,p_module,p_action,md5(v_data::text),v_result);
  insert into public.audit_events(entity,record_id,action,before_data,after_data,reason,created_by,actor_name)
    values('operations_'||p_module,v_id,p_action,v_before,v_after,v_reason,v_actor,v_name);
  return v_result;
end; $$;

create function private.operations_snapshot(p_module text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_role text:=private.operations_role(); v_uid uuid:=auth.uid(); v_result jsonb; v_rows jsonb; v_customer uuid;
begin
  if v_uid is null then raise exception 'Acesso não autorizado.' using errcode='42501'; end if;
  if p_module='commercial' and v_role is null then
    select id into v_customer from public.sales_customers where user_id=v_uid;
    -- A blocked staff account must never become a customer bypass.
    if v_customer is null or exists(select 1 from public.staff_members where user_id=v_uid)
      then raise exception 'Acesso não autorizado.' using errcode='42501'; end if;
    v_result:=jsonb_build_object('module',p_module,'role','customer');
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]'::jsonb) into v_rows from public.sales_customers where id=v_customer;
    v_result:=v_result||jsonb_build_object('customers',v_rows);
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'customer_id',customer_id,'status',status,'created_at',created_at) order by created_at desc),'[]'::jsonb)
      into v_rows from public.sales_orders where customer_id=v_customer;
    v_result:=v_result||jsonb_build_object('orders',v_rows);
    select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'order_id',l.order_id,'description',l.description,'unit',l.unit,'quantity',l.quantity,'unit_price',l.unit_price)),'[]'::jsonb)
      into v_rows from public.sales_order_lines l join public.sales_orders o on o.id=l.order_id where o.customer_id=v_customer;
    v_result:=v_result||jsonb_build_object('lines',v_rows);
    select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'order_id',s.order_id,'created_at',s.created_at)),'[]'::jsonb)
      into v_rows from public.sales_shipments s join public.sales_orders o on o.id=s.order_id where o.customer_id=v_customer;
    v_result:=v_result||jsonb_build_object('shipments',v_rows);
    select coalesce(jsonb_agg(jsonb_build_object('id',sl.id,'shipment_id',sl.shipment_id,'line_id',sl.line_id,'quantity',sl.quantity,'lot_code',l.code,'expires_on',l.expires_on)),'[]'::jsonb)
      into v_rows from public.sales_shipment_lines sl join public.sales_shipments s on s.id=sl.shipment_id
        join public.sales_orders o on o.id=s.order_id join public.lots l on l.id=sl.lot_id where o.customer_id=v_customer;
    return v_result||jsonb_build_object('shipment_lines',v_rows);
  end if;
  if v_role is null or p_module is null or p_module not in ('inventory','receiving','staff','alerts','finance','commercial','time')
    or (p_module in ('inventory','receiving','finance','commercial') and v_role<>'admin')
    or (p_module in ('staff','alerts') and v_role not in ('admin','manager'))
    then raise exception 'Acesso não autorizado ao módulo.' using errcode='42501'; end if;
  v_result:=jsonb_build_object('module',p_module,'role',v_role);
  if p_module='inventory' then
    select coalesce(jsonb_agg(to_jsonb(c) order by created_at desc),'[]'::jsonb) into v_rows from public.inventory_counts c;
    v_result:=v_result||jsonb_build_object('counts',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into v_rows from public.inventory_count_lines c;
    v_result:=v_result||jsonb_build_object('count_lines',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c) order by created_at desc),'[]'::jsonb) into v_rows from public.stock_movements c;
    v_result:=v_result||jsonb_build_object('movements',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into v_rows from public.inventory_lots c join public.storage_locations s on s.id=c.location_id
      join public.item_variants iv on iv.id=c.variant_id join public.products p on p.id=iv.product_id join public.categories cat on cat.id=p.category_id
      where s.active and iv.active and p.active and cat.active;
    v_result:=v_result||jsonb_build_object('lots',v_rows);
  elsif p_module='receiving' then
    select coalesce(jsonb_agg(to_jsonb(c) order by name,revision desc),'[]'::jsonb) into v_rows from public.inspection_templates c;
    v_result:=v_result||jsonb_build_object('templates',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c) order by created_at desc),'[]'::jsonb) into v_rows from public.receipt_inspections c;
    v_result:=v_result||jsonb_build_object('inspections',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c) order by created_at desc),'[]'::jsonb) into v_rows from public.private_attachments c;
    v_result:=v_result||jsonb_build_object('attachments',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c) order by created_at desc),'[]'::jsonb) into v_rows from public.receipts c;
    v_result:=v_result||jsonb_build_object('receipts',v_rows);
  elsif p_module='staff' then
    select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'user_id',user_id,'display_name',display_name,'role',role,'active',active,'created_at',created_at) order by display_name),'[]'::jsonb)
      into v_rows from public.staff_members where v_role='admin' or role<>'admin';
    v_result:=v_result||jsonb_build_object('members',v_rows);
  elsif p_module='alerts' then
    select coalesce(jsonb_agg(to_jsonb(c) order by created_at desc),'[]'::jsonb) into v_rows from public.alert_rules c;
    v_result:=v_result||jsonb_build_object('rules',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c) order by measured_at desc),'[]'::jsonb) into v_rows from public.temperature_readings c;
    v_result:=v_result||jsonb_build_object('readings',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c) order by created_at desc),'[]'::jsonb) into v_rows from public.operational_alerts c;
    v_result:=v_result||jsonb_build_object('events',v_rows);
  elsif p_module='finance' then
    select coalesce(jsonb_agg(to_jsonb(c) order by name),'[]'::jsonb) into v_rows from public.financial_accounts c;
    v_result:=v_result||jsonb_build_object('accounts',v_rows);
    select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('paid_amount',p.paid,'outstanding_amount',t.amount-p.paid,'remaining_amount',t.amount-p.paid) order by t.due_on),'[]'::jsonb)
      into v_rows from public.financial_titles t cross join lateral
        (select coalesce(sum(case when reversal_of is null then amount else -amount end),0) paid from public.financial_settlements where title_id=t.id) p;
    v_result:=v_result||jsonb_build_object('titles',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c) order by created_at desc),'[]'::jsonb) into v_rows from public.financial_settlements c;
    v_result:=v_result||jsonb_build_object('settlements',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c) order by created_at desc),'[]'::jsonb) into v_rows from public.financial_reconciliations c;
    v_result:=v_result||jsonb_build_object('reconciliations',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c) order by created_at desc),'[]'::jsonb) into v_rows from public.receipts c;
    v_result:=v_result||jsonb_build_object('receipts',v_rows);
    select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'account_id',a.id,'name',a.name,'recorded_balance',
      coalesce((select sum((case when t.kind='receivable' then 1 else -1 end)*(case when s.reversal_of is null then 1 else -1 end)*s.amount)
        from public.financial_settlements s join public.financial_titles t on t.id=s.title_id where s.account_id=a.id),0))),'[]'::jsonb)
      into v_rows from public.financial_accounts a;
    v_result:=v_result||jsonb_build_object('balances',v_rows);
  elsif p_module='commercial' then
    select coalesce(jsonb_agg(to_jsonb(c) order by name),'[]'::jsonb) into v_rows from public.sales_customers c;
    v_result:=v_result||jsonb_build_object('customers',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c) order by name),'[]'::jsonb) into v_rows from public.sales_catalog c;
    v_result:=v_result||jsonb_build_object('catalog',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c) order by created_at desc),'[]'::jsonb) into v_rows from public.sales_orders c;
    v_result:=v_result||jsonb_build_object('orders',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('name',c.description)),'[]'::jsonb) into v_rows from public.sales_order_lines c;
    v_result:=v_result||jsonb_build_object('lines',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into v_rows from public.stock_reservations c;
    v_result:=v_result||jsonb_build_object('reservations',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into v_rows from public.sales_shipments c;
    v_result:=v_result||jsonb_build_object('shipments',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('lot_code',l.code,'expires_on',l.expires_on)),'[]'::jsonb)
      into v_rows from public.sales_shipment_lines c join public.lots l on l.id=c.lot_id;
    v_result:=v_result||jsonb_build_object('shipment_lines',v_rows);
    select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into v_rows from public.sales_returns c;
    v_result:=v_result||jsonb_build_object('returns',v_rows);
    select coalesce(jsonb_agg(to_jsonb(l)||jsonb_build_object('reserved_quantity',coalesce((select sum(r.quantity) from public.stock_reservations r where r.lot_id=l.id and status='active'),0))),'[]'::jsonb)
      into v_rows from public.inventory_lots l join public.storage_locations s on s.id=l.location_id
      join public.item_variants iv on iv.id=l.variant_id join public.products p on p.id=iv.product_id join public.categories c on c.id=p.category_id
      where s.active and iv.active and p.active and c.active and l.quantity>0 and (l.expires_on is null or l.expires_on>=current_date);
    v_result:=v_result||jsonb_build_object('lots',v_rows);
  elsif p_module='time' then
    select coalesce(jsonb_agg(to_jsonb(c) order by created_at desc),'[]'::jsonb) into v_rows from public.time_entries c where user_id=v_uid;
    v_result:=v_result||jsonb_build_object('entries',v_rows);
  end if;
  if p_module in ('inventory','alerts') then
    select coalesce(jsonb_agg(to_jsonb(c) order by name),'[]'::jsonb) into v_rows from public.storage_locations c where active;
    v_result:=v_result||jsonb_build_object('locations',v_rows);
  end if;
  return v_result;
end; $$;

revoke all on function private.operations_role(),private.operations_text(jsonb,text,integer,integer),
  private.operations_number(jsonb,text,integer,numeric,numeric),private.operations_immutable(),private.protect_reserved_stock(),
  private.operations_command(uuid,text,text,jsonb),private.operations_snapshot(text) from public,anon,authenticated;
grant execute on function private.operations_command(uuid,text,text,jsonb),private.operations_snapshot(text) to authenticated;
create function public.operations_command(p_command_id uuid,p_module text,p_action text,p_data jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.operations_command(p_command_id,p_module,p_action,p_data);
$$;
create function public.operations_snapshot(p_module text)
returns jsonb language sql stable security invoker set search_path = '' as $$ select private.operations_snapshot(p_module); $$;
revoke all on function public.operations_command(uuid,text,text,jsonb),public.operations_snapshot(text) from public,anon;
grant execute on function public.operations_command(uuid,text,text,jsonb),public.operations_snapshot(text) to authenticated;
