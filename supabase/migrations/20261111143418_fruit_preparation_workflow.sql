-- Fruit preparation is an inventory transformation before pulping. It never
-- creates finished pulp and never derives kilograms from sacks or buckets.
create sequence public.preparation_code_sequence;
revoke all on sequence public.preparation_code_sequence from public, anon, authenticated;

create table public.preparation_guides (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  revision integer not null check (revision > 0),
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  steps jsonb not null check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) between 1 and 6),
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (product_id, revision),
  check (status <> 'approved' or (approved_by is not null and approved_at is not null))
);
create unique index preparation_guides_one_approved_per_product
  on public.preparation_guides(product_id) where status = 'approved';

create table public.preparation_batches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(trim(code)) between 4 and 80),
  source_lot_id uuid not null references public.lots(id),
  input_quantity numeric(14,3) not null check (input_quantity > 0),
  input_unit text not null check (input_unit in ('kg','g','l','un','pct','cx')),
  input_cost numeric(14,2) not null check (input_cost between 0 and 999999999),
  guide_snapshot jsonb not null,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  started_at timestamptz not null,
  paused_at timestamptz,
  paused_seconds numeric(14,3) not null default 0 check (paused_seconds >= 0),
  completed_at timestamptz,
  processed_quantity numeric(14,3),
  bucket_count integer check (bucket_count between 1 and 40),
  destination text check (destination in ('freezer','pulping')),
  location_id uuid references public.storage_locations(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (status <> 'completed' or (completed_at is not null and processed_quantity > 0
    and bucket_count is not null and destination is not null and location_id is not null)),
  check (status = 'active' or paused_at is null)
);
create index preparation_batches_source_idx on public.preparation_batches(source_lot_id);
create index preparation_batches_status_idx on public.preparation_batches(status,started_at desc);

alter table public.lots
  add column preparation_batch_id uuid references public.preparation_batches(id),
  add constraint lots_preparation_origin_check
    check (preparation_batch_id is null or (receipt_id is null and production_run_id is null));
create index lots_preparation_batch_idx on public.lots(preparation_batch_id)
  where preparation_batch_id is not null;

create table public.preparation_workers (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.preparation_batches(id),
  user_id uuid not null references auth.users(id),
  started_at timestamptz not null,
  ended_at timestamptz,
  paused_at timestamptz,
  paused_seconds numeric(14,3) not null default 0 check (paused_seconds >= 0),
  created_at timestamptz not null default now(),
  check (ended_at is null or (ended_at >= started_at and paused_at is null))
);
create unique index preparation_workers_one_open_session
  on public.preparation_workers(user_id) where ended_at is null;
create index preparation_workers_batch_idx on public.preparation_workers(batch_id,started_at);

create table private.preparation_settings (
  singleton boolean primary key default true check (singleton),
  work_minutes integer not null default 90 check (work_minutes between 15 and 240),
  rest_minutes integer not null default 30 check (rest_minutes between 5 and 90)
);
insert into private.preparation_settings default values;
revoke all on private.preparation_settings from public,anon,authenticated;

create table private.preparation_commands (
  command_id uuid primary key,
  batch_id uuid,
  requester_id uuid not null,
  actor_id uuid,
  kind text not null,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
revoke all on private.preparation_commands from public, anon, authenticated;

do $$
declare v_table text;
begin
  foreach v_table in array array['preparation_guides','preparation_batches','preparation_workers'] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('revoke all on public.%I from public,anon,authenticated',v_table);
  end loop;
end;
$$;

alter table public.stock_movements
  drop constraint stock_movements_kind_check,
  drop constraint stock_movements_quantity_kind_check;
alter table public.stock_movements
  add constraint stock_movements_kind_check check (kind in
    ('receipt','dispatch','external_dispatch','loss','note','production_input','production_output',
     'inventory_adjustment','compensation','order_dispatch','sales_return',
     'preparation_input','preparation_return','preparation_output')),
  add constraint stock_movements_quantity_kind_check check (
    (kind in ('receipt','production_output','sales_return','preparation_return','preparation_output') and quantity > 0)
    or (kind in ('dispatch','external_dispatch','loss','production_input','order_dispatch','preparation_input') and quantity < 0)
    or (kind in ('inventory_adjustment','compensation') and quantity <> 0)
    or (kind = 'note' and quantity = 0));

-- Keep the existing view column order and append the new column at the end.
create or replace view public.inventory_lots with (security_invoker = true) as
select
  l.id,l.code,l.variant_id,l.location_id,l.supplier_id,l.supplier_lot,l.reference,
  l.received_at,l.manufactured_on,l.expires_on,l.expiry_source,l.unit,
  l.initial_quantity,l.initial_weight_kg,l.total_cost,l.unit_cost,l.quantity,
  l.inspection_notes,l.created_by,l.created_at,l.receipt_id,l.production_run_id,
  p.name as product_name,c.name as category_name,v.name as variant_name,v.sku,
  v.is_default,p.has_variants,s.name as location_name,
  coalesce(f.name,'Produção interna') as supplier_name,
  case when l.preparation_batch_id is not null then 'preparation'
    when l.production_run_id is not null then 'production' else 'supplier' end as origin,
  l.initial_weight_kg * l.quantity / l.initial_quantity as remaining_weight_kg,
  concat_ws(' ',l.code,p.name,case when v.is_default then null else v.name end,
    v.sku,s.name,f.name,case when l.preparation_batch_id is not null then 'fruta preparada descascada' end) as search_text,
  l.preparation_batch_id
from public.lots l
join public.item_variants v on v.id=l.variant_id
join public.products p on p.id=v.product_id
join public.categories c on c.id=p.category_id
join public.storage_locations s on s.id=l.location_id
left join public.suppliers f on f.id=l.supplier_id;

-- A guide makes preparation mandatory for future production inputs of that
-- fruit. Existing production orders and fruits without a guide stay valid.
create function private.require_prepared_production_input() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.lots l
    join public.item_variants v on v.id=l.variant_id
    join public.preparation_guides g on g.product_id=v.product_id and g.status='approved'
    where l.id=new.source_lot_id and l.preparation_batch_id is null
  ) then
    raise exception 'Esta fruta precisa passar pelo preparo antes da despolpa.';
  end if;
  return new;
end;
$$;
create trigger production_requires_prepared_fruit
  before insert on public.production_inputs for each row
  execute function private.require_prepared_production_input();
revoke all on function private.require_prepared_production_input() from public,anon,authenticated;

insert into public.storage_locations(name,description)
select 'Área de despolpa','Materiais preparados aguardando entrada na despolpadeira'
where not exists (
  select 1 from public.storage_locations where lower(trim(name))='área de despolpa'
);

create function private.preparation_pin_identity(p_pin text)
returns table(user_id uuid,error_code text)
language plpgsql security definer set search_path = '' as $$
declare
  v_requester uuid:=auth.uid();
  v_attempt private.production_pin_attempts;
  v_worker uuid;
  v_matches integer;
  v_failed smallint;
begin
  if not public.can_operate_production() then
    raise exception 'Acesso não autorizado.' using errcode='42501';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return query select null::uuid,'invalid'::text;
    return;
  end if;
  insert into private.production_pin_attempts(authenticated_user_id)
  values(v_requester) on conflict(authenticated_user_id) do nothing;
  select * into v_attempt from private.production_pin_attempts
    where authenticated_user_id=v_requester for update;
  if v_attempt.locked_until>now() then
    return query select null::uuid,'locked'::text;
    return;
  end if;
  if v_attempt.window_started_at<now()-interval '5 minutes' then
    update private.production_pin_attempts
      set failed_attempts=0,window_started_at=now(),locked_until=null
      where authenticated_user_id=v_requester;
    v_attempt.failed_attempts:=0;
  end if;
  select count(*) into v_matches
    from public.staff_members m
    where m.active and m.production_pin_hash is not null
      and extensions.crypt(p_pin,m.production_pin_hash)=m.production_pin_hash;
  if v_matches=1 then
    select m.user_id into v_worker from public.staff_members m
      where m.active and m.production_pin_hash is not null
        and extensions.crypt(p_pin,m.production_pin_hash)=m.production_pin_hash;
  end if;
  if v_matches<>1 then
    v_failed:=v_attempt.failed_attempts+1;
    update private.production_pin_attempts set failed_attempts=v_failed,
      locked_until=case when v_failed>=5 then now()+interval '1 minute' end
      where authenticated_user_id=v_requester;
    return query select null::uuid,
      case when v_failed>=5 then 'locked' else 'invalid' end::text;
    return;
  end if;
  delete from private.production_pin_attempts where authenticated_user_id=v_requester;
  return query select v_worker,null::text;
end;
$$;
revoke all on function private.preparation_pin_identity(text) from public,anon,authenticated;

create function private.preparation_sync_pause(p_batch_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_running boolean;
begin
  select exists(select 1 from public.preparation_workers
    where batch_id=p_batch_id and ended_at is null and paused_at is null)
    into v_running;
  if v_running then
    update public.preparation_batches
      set paused_seconds=paused_seconds+greatest(0,extract(epoch from now()-paused_at)),
        paused_at=null
      where id=p_batch_id and status='active' and paused_at is not null;
  else
    update public.preparation_batches set paused_at=greatest(now(),started_at)
      where id=p_batch_id and status='active' and paused_at is null;
  end if;
end;
$$;
revoke all on function private.preparation_sync_pause(uuid) from public,anon,authenticated;

create function private.preparation_snapshot() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_admin boolean;
begin
  if not public.can_operate_production() then
    raise exception 'Acesso não autorizado.' using errcode='42501';
  end if;
  v_admin:=public.can_manage_inventory();
  return jsonb_build_object(
    'serverTime',now(),
    'reminders',(select jsonb_build_object('workMinutes',work_minutes,'restMinutes',rest_minutes)
      from private.preparation_settings where singleton),
    'actor',(select jsonb_build_object('id',user_id,'name',display_name,'role',role)
      from public.staff_members where user_id=auth.uid() and active),
    'guides',coalesce((select jsonb_agg(jsonb_build_object(
      'id',g.id,'productId',g.product_id,'productName',p.name,
      'revision',g.revision,'status',g.status,'steps',g.steps)
      order by p.name,g.revision desc)
      from public.preparation_guides g join public.products p on p.id=g.product_id
      where g.status='approved' or (v_admin and g.status='draft')),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name)
      from public.products p join public.categories c on c.id=p.category_id
      where p.active and c.active and lower(trim(c.name)) in ('frutas','frutas recebidas')),'[]'::jsonb),
    'rawLots',coalesce((select jsonb_agg(jsonb_build_object(
      'id',l.id,'code',l.code,'productId',p.id,'productName',p.name,
      'quantity',l.quantity,'unit',l.unit,'locationName',s.name,
      'expiresOn',l.expires_on) order by p.name,l.expires_on nulls last,l.id)
      from public.lots l join public.item_variants v on v.id=l.variant_id
      join public.products p on p.id=v.product_id
      join public.categories c on c.id=p.category_id
      join public.storage_locations s on s.id=l.location_id
      where l.quantity>0 and l.preparation_batch_id is null and l.production_run_id is null
        and v.active and p.active and c.active and s.active
        and lower(trim(c.name)) in ('frutas','frutas recebidas')
        and (l.expires_on is null or l.expires_on>=(now() at time zone 'America/Sao_Paulo')::date)),'[]'::jsonb),
    'locations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name)
      from public.storage_locations where active),'[]'::jsonb),
    'batches',coalesce((select jsonb_agg(jsonb_build_object(
      'id',b.id,'code',b.code,'status',b.status,'sourceLotId',l.id,
      'sourceCode',l.code,'productName',p.name,'productId',p.id,
      'inputQuantity',b.input_quantity,'inputUnit',b.input_unit,
      'startedAt',b.started_at,'pausedAt',b.paused_at,'pausedSeconds',b.paused_seconds,
      'completedAt',b.completed_at,'processedQuantity',b.processed_quantity,
      'bucketCount',b.bucket_count,'destination',b.destination,
      'locationName',sl.name,'guide',b.guide_snapshot,
      'workers',coalesce((select jsonb_agg(jsonb_build_object(
        'id',w.id,'userId',w.user_id,'name',m.display_name,'startedAt',w.started_at,
        'endedAt',w.ended_at,'pausedAt',w.paused_at,'pausedSeconds',w.paused_seconds)
        order by w.started_at,w.id)
        from public.preparation_workers w join public.staff_members m on m.user_id=w.user_id
        where w.batch_id=b.id),'[]'::jsonb),
      'outputLots',coalesce((select jsonb_agg(jsonb_build_object(
        'id',o.id,'code',o.code,'quantity',o.quantity,'weightKg',o.initial_weight_kg,
        'locationId',o.location_id) order by o.code)
        from public.lots o where o.preparation_batch_id=b.id),'[]'::jsonb))
      order by b.started_at desc,b.id)
      from (select * from public.preparation_batches
        where status='active' or completed_at>now()-interval '30 days'
        order by started_at desc,id limit 60) b
      join public.lots l on l.id=b.source_lot_id
      join public.item_variants v on v.id=l.variant_id
      join public.products p on p.id=v.product_id
      left join public.storage_locations sl on sl.id=b.location_id),'[]'::jsonb)
  );
end;
$$;
revoke all on function private.preparation_snapshot() from public,anon,authenticated;
grant execute on function private.preparation_snapshot() to authenticated;
create function public.preparation_snapshot() returns jsonb
language sql security invoker set search_path = '' as $$
  select private.preparation_snapshot();
$$;
revoke all on function public.preparation_snapshot() from public,anon;
grant execute on function public.preparation_snapshot() to authenticated;

create function private.preparation_command(
  p_command_id uuid,p_batch_id uuid,p_kind text,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_requester uuid:=auth.uid(); v_actor uuid; v_pin_error text;
  v_cached private.preparation_commands; v_batch public.preparation_batches;
  v_lot public.lots; v_guide public.preparation_guides; v_worker public.preparation_workers;
  v_admin boolean; v_manager boolean; v_actor_manager boolean; v_quantity numeric(14,3); v_processed numeric(14,3);
  v_count integer; v_index integer; v_weight numeric(17,6); v_weights jsonb;
  v_location uuid; v_destination text; v_code text; v_id uuid; v_result jsonb;
  v_cost numeric(14,2); v_output_cost numeric(14,2); v_piece_cost numeric(14,2);
  v_actor_name text; v_step jsonb; v_steps jsonb; v_product uuid;
  v_now timestamptz:=now(); v_reason text;
begin
  if not public.can_operate_production() then
    raise exception 'Acesso não autorizado.' using errcode='42501';
  end if;
  if p_command_id is null or p_kind is null or p_kind not in
    ('save_guide','approve_guide','set_reminders','start','join','break','resume','leave','finish','cancel')
    or p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>8192 then
    raise exception 'Comando de preparo inválido.';
  end if;
  v_admin:=public.can_manage_inventory();
  v_manager:=exists(select 1 from public.staff_members
    where user_id=v_requester and active and role in ('admin','manager'));
  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text,29));
  select * into v_cached from private.preparation_commands where command_id=p_command_id;
  if found then
    if v_cached.requester_id<>v_requester or v_cached.batch_id is distinct from p_batch_id
      or v_cached.kind<>p_kind or v_cached.payload<>(p_payload-'pin') then
      raise exception 'Identificador de comando já usado para outra ação.';
    end if;
    return v_cached.result;
  end if;

  if p_kind in ('save_guide','approve_guide','set_reminders') then
    if not v_admin then raise exception 'Somente um administrador pode aprovar o preparo.' using errcode='42501'; end if;
    if p_batch_id is not null or p_payload ? 'pin' then raise exception 'Dados de guia inválidos.'; end if;
  else
    select user_id,error_code into v_actor,v_pin_error
      from private.preparation_pin_identity(p_payload->>'pin');
    if v_pin_error is not null then
      return jsonb_build_object('ok',false,'error',case when v_pin_error='locked'
        then 'PIN temporariamente bloqueado. Aguarde um minuto.' else 'PIN inválido.' end);
    end if;
    select display_name into v_actor_name from public.staff_members where user_id=v_actor and active;
    if v_actor_name is null then raise exception 'Operador inativo.'; end if;
    v_actor_manager:=exists(select 1 from public.staff_members where user_id=v_actor
      and active and role in ('admin','manager'));
  end if;

  if p_kind='save_guide' then
    if (select count(*) from jsonb_object_keys(p_payload))<>2
      or not (p_payload ? 'productId' and p_payload ? 'steps') then raise exception 'Dados de guia inválidos.'; end if;
    v_product:=(p_payload->>'productId')::uuid;
    v_steps:=p_payload->'steps';
    if jsonb_typeof(v_steps)<>'array' or jsonb_array_length(v_steps) not between 1 and 6
      or not exists(select 1 from public.products p join public.categories c on c.id=p.category_id
        where p.id=v_product and p.active and lower(trim(c.name)) in ('frutas','frutas recebidas')) then
      raise exception 'Selecione uma fruta e informe de uma a seis instruções.';
    end if;
    for v_step in select value from jsonb_array_elements(v_steps) loop
      if jsonb_typeof(v_step)<>'string' or length(trim(v_step#>>'{}')) not between 5 and 140 then
        raise exception 'Cada instrução precisa ter de 5 a 140 caracteres.';
      end if;
    end loop;
    insert into public.preparation_guides(product_id,revision,steps,created_by)
      values(v_product,(select coalesce(max(revision),0)+1 from public.preparation_guides where product_id=v_product),v_steps,v_requester)
      returning id into v_id;
    v_result:=jsonb_build_object('ok',true,'id',v_id);
  elsif p_kind='approve_guide' then
    if (select count(*) from jsonb_object_keys(p_payload))<>1 or not (p_payload ? 'guideId') then
      raise exception 'Guia inválido.';
    end if;
    select * into v_guide from public.preparation_guides
      where id=(p_payload->>'guideId')::uuid for update;
    if v_guide.id is null or v_guide.status<>'draft' then raise exception 'Guia indisponível para aprovação.'; end if;
    update public.preparation_guides set status='retired'
      where product_id=v_guide.product_id and status='approved';
    update public.preparation_guides set status='approved',approved_by=v_requester,approved_at=v_now
      where id=v_guide.id;
    v_result:=jsonb_build_object('ok',true,'id',v_guide.id);
  elsif p_kind='set_reminders' then
    if (select count(*) from jsonb_object_keys(p_payload))<>2
      or not (p_payload ? 'workMinutes' and p_payload ? 'restMinutes') then
      raise exception 'Lembretes inválidos.';
    end if;
    update private.preparation_settings
      set work_minutes=(p_payload->>'workMinutes')::integer,
        rest_minutes=(p_payload->>'restMinutes')::integer where singleton;
    v_result:=jsonb_build_object('ok',true);
  elsif p_kind='start' then
    if p_batch_id is not null or (select count(*) from jsonb_object_keys(p_payload))<>3
      or not (p_payload ? 'lotId' and p_payload ? 'quantity' and p_payload ? 'pin') then
      raise exception 'Dados iniciais inválidos.';
    end if;
    select * into v_lot from public.lots where id=(p_payload->>'lotId')::uuid for update;
    if v_lot.id is null or v_lot.preparation_batch_id is not null or v_lot.production_run_id is not null
      or not exists(select 1 from public.item_variants v join public.products p on p.id=v.product_id
        join public.categories c on c.id=p.category_id
        where v.id=v_lot.variant_id and v.active and p.active and c.active
          and lower(trim(c.name)) in ('frutas','frutas recebidas'))
      or (v_lot.expires_on is not null and v_lot.expires_on<(v_now at time zone 'America/Sao_Paulo')::date) then
      raise exception 'Lote de fruta indisponível para preparo.';
    end if;
    select g.* into v_guide from public.preparation_guides g
      join public.item_variants v on v.product_id=g.product_id
      where v.id=v_lot.variant_id and g.status='approved';
    if v_guide.id is null then raise exception 'A fruta precisa de um guia aprovado antes do preparo.'; end if;
    v_quantity:=(p_payload->>'quantity')::numeric;
    if v_quantity<=0 or v_quantity>v_lot.quantity or
      (v_lot.unit in ('un','pct','cx') and v_quantity<>trunc(v_quantity)) then
      raise exception 'Quantidade acima do saldo ou incompatível com a unidade.';
    end if;
    if exists(select 1 from public.preparation_workers where user_id=v_actor and ended_at is null) then
      raise exception 'Operador já participa de outro preparo.';
    end if;
    v_cost:=round(v_lot.total_cost*v_quantity/v_lot.initial_quantity,2);
    v_code:='PREP-'||to_char(v_now at time zone 'America/Sao_Paulo','YYYYMMDD')||'-'||nextval('public.preparation_code_sequence');
    insert into public.preparation_batches(code,source_lot_id,input_quantity,input_unit,input_cost,
      guide_snapshot,started_at,created_by)
      values(v_code,v_lot.id,v_quantity,v_lot.unit,v_cost,
        jsonb_build_object('guideId',v_guide.id,'revision',v_guide.revision,'steps',v_guide.steps),v_now+interval '3 seconds',v_actor)
      returning id into v_id;
    update public.lots set quantity=quantity-v_quantity where id=v_lot.id;
    insert into public.stock_movements(request_id,lot_id,kind,quantity,balance_after,reason,
      operated_at,created_by,actor_name)
      values(gen_random_uuid(),v_lot.id,'preparation_input',-v_quantity,v_lot.quantity-v_quantity,
        'Início do preparo '||v_code,v_now,v_actor,v_actor_name);
    insert into public.preparation_workers(batch_id,user_id,started_at)
      values(v_id,v_actor,v_now+interval '3 seconds');
    v_result:=jsonb_build_object('ok',true,'id',v_id);
  else
    if p_batch_id is null then raise exception 'Selecione um preparo.'; end if;
    select * into v_batch from public.preparation_batches where id=p_batch_id for update;
    if v_batch.id is null or v_batch.status<>'active' then raise exception 'Preparo não está ativo.'; end if;
    if v_now<v_batch.started_at then raise exception 'Aguarde a contagem regressiva.'; end if;
    select * into v_worker from public.preparation_workers
      where batch_id=p_batch_id and user_id=v_actor and ended_at is null for update;

    if p_kind='join' then
      if (select count(*) from jsonb_object_keys(p_payload))<>1 then raise exception 'Dados inválidos.'; end if;
      if v_worker.id is not null then raise exception 'Operador já participa deste preparo.'; end if;
      if exists(select 1 from public.preparation_workers where user_id=v_actor and ended_at is null) then
        raise exception 'Operador já participa de outro preparo.';
      end if;
      insert into public.preparation_workers(batch_id,user_id,started_at) values(p_batch_id,v_actor,v_now);
    elsif p_kind in ('break','resume','leave') then
      if (select count(*) from jsonb_object_keys(p_payload))<>1 or v_worker.id is null then
        raise exception 'Operador não está neste preparo.';
      end if;
      if p_kind='break' then
        if v_worker.paused_at is not null then raise exception 'Operador já está em pausa.'; end if;
        update public.preparation_workers set paused_at=v_now where id=v_worker.id;
      elsif p_kind='resume' then
        if v_worker.paused_at is null then raise exception 'Operador não está em pausa.'; end if;
        update public.preparation_workers set paused_seconds=paused_seconds+extract(epoch from v_now-paused_at),
          paused_at=null where id=v_worker.id;
      else
        update public.preparation_workers set paused_seconds=paused_seconds+
          case when paused_at is null then 0 else extract(epoch from v_now-paused_at) end,
          paused_at=null,ended_at=v_now where id=v_worker.id;
      end if;
    elsif p_kind='finish' then
      if v_worker.id is null and not v_actor_manager then raise exception 'Operador não participa deste preparo.'; end if;
      if (select count(*) from jsonb_object_keys(p_payload))<>6 or
        not (p_payload ? 'pin' and p_payload ? 'processedQuantity' and p_payload ? 'bucketCount'
          and p_payload ? 'destination' and p_payload ? 'locationId' and p_payload ? 'weightsKg') then
        raise exception 'Dados de conclusão incompletos.';
      end if;
      v_processed:=(p_payload->>'processedQuantity')::numeric;
      v_count:=(p_payload->>'bucketCount')::integer;
      v_destination:=p_payload->>'destination';
      v_location:=(p_payload->>'locationId')::uuid;
      v_weights:=p_payload->'weightsKg';
      if v_processed<=0 or v_processed>v_batch.input_quantity or v_count not between 1 and 40
        or (v_batch.input_unit in ('un','pct','cx') and v_processed<>trunc(v_processed))
        or v_destination not in ('freezer','pulping')
        or not exists(select 1 from public.storage_locations where id=v_location and active
          and ((v_destination='freezer' and lower(trim(name)) like 'freezer %')
            or (v_destination='pulping' and lower(trim(name))='área de despolpa'))) then
        raise exception 'Quantidade, destino ou local inválido.';
      end if;
      if v_weights<>'null'::jsonb then
        if jsonb_typeof(v_weights)<>'array' or jsonb_array_length(v_weights)<>v_count then
          raise exception 'Informe um peso para cada balde ou deixe todos sem peso.';
        end if;
        for v_step in select value from jsonb_array_elements(v_weights) loop
          if jsonb_typeof(v_step)<>'number' or (v_step#>>'{}')::numeric<=0 then
            raise exception 'Peso de balde inválido.';
          end if;
        end loop;
      end if;
      select * into v_lot from public.lots where id=v_batch.source_lot_id for update;
      if v_processed<v_batch.input_quantity then
        update public.lots set quantity=quantity+(v_batch.input_quantity-v_processed) where id=v_lot.id;
        insert into public.stock_movements(request_id,lot_id,kind,quantity,balance_after,reason,
          operated_at,created_by,actor_name)
          values(gen_random_uuid(),v_lot.id,'preparation_return',v_batch.input_quantity-v_processed,
            v_lot.quantity+v_batch.input_quantity-v_processed,
            'Parte não preparada de '||v_batch.code,v_now,v_actor,v_actor_name);
      end if;
      v_output_cost:=round(v_batch.input_cost*v_processed/v_batch.input_quantity,2);
      for v_index in 1..v_count loop
        v_weight:=null;
        if v_weights<>'null'::jsonb then v_weight:=(v_weights->>(v_index-1))::numeric; end if;
        v_piece_cost:=case when v_index=v_count then v_output_cost-round(v_output_cost/v_count,2)*(v_count-1)
          else round(v_output_cost/v_count,2) end;
        insert into public.lots(code,variant_id,location_id,supplier_id,supplier_lot,reference,
          received_at,manufactured_on,expires_on,expiry_source,unit,initial_quantity,
          initial_weight_kg,total_cost,quantity,inspection_notes,created_by,preparation_batch_id)
          values(v_batch.code||'-'||v_index,v_lot.variant_id,v_location,v_lot.supplier_id,
            v_lot.supplier_lot,v_lot.code,v_now,null,v_lot.expires_on,v_lot.expiry_source,'un',1,
            v_weight,v_piece_cost,1,'Fruta preparada para despolpa. Origem: '||v_lot.code,
            v_actor,p_batch_id) returning id into v_id;
        insert into public.stock_movements(request_id,lot_id,kind,quantity,balance_after,reason,
          operated_at,created_by,actor_name)
          values(gen_random_uuid(),v_id,'preparation_output',1,1,
            'Balde preparado em '||v_batch.code,v_now,v_actor,v_actor_name);
      end loop;
      update public.preparation_workers set paused_seconds=paused_seconds+
        case when paused_at is null then 0 else extract(epoch from v_now-paused_at) end,
        paused_at=null,ended_at=v_now where batch_id=p_batch_id and ended_at is null;
      update public.preparation_batches set status='completed',completed_at=v_now,
        paused_seconds=paused_seconds+
          case when paused_at is null then 0 else extract(epoch from v_now-paused_at) end,
        paused_at=null,processed_quantity=v_processed,bucket_count=v_count,
        destination=v_destination,location_id=v_location where id=p_batch_id;
    elsif p_kind='cancel' then
      if not v_manager or not v_actor_manager or not coalesce((p_payload->>'allUnprocessed')::boolean,false)
        or length(trim(coalesce(p_payload->>'reason',''))) not between 8 and 240 then
        raise exception 'O cancelamento exige gestor, justificativa e confirmação de que nada foi preparado.';
      end if;
      select * into v_lot from public.lots where id=v_batch.source_lot_id for update;
      update public.lots set quantity=quantity+v_batch.input_quantity where id=v_lot.id;
      v_reason:=trim(p_payload->>'reason');
      insert into public.stock_movements(request_id,lot_id,kind,quantity,balance_after,reason,
        operated_at,created_by,actor_name)
        values(gen_random_uuid(),v_lot.id,'preparation_return',v_batch.input_quantity,
          v_lot.quantity+v_batch.input_quantity,'Cancelamento de '||v_batch.code||': '||v_reason,
          v_now,v_actor,v_actor_name);
      update public.preparation_workers set paused_seconds=paused_seconds+
        case when paused_at is null then 0 else extract(epoch from v_now-paused_at) end,
        paused_at=null,ended_at=v_now where batch_id=p_batch_id and ended_at is null;
      update public.preparation_batches set status='cancelled',completed_at=v_now,
        paused_seconds=paused_seconds+
          case when paused_at is null then 0 else extract(epoch from v_now-paused_at) end,
        paused_at=null where id=p_batch_id;
    end if;
    if p_kind in ('join','break','resume','leave') then
      perform private.preparation_sync_pause(p_batch_id);
    end if;
    v_result:=jsonb_build_object('ok',true,'id',p_batch_id);
  end if;
  insert into private.preparation_commands(command_id,batch_id,requester_id,actor_id,kind,payload,result)
    values(p_command_id,p_batch_id,v_requester,v_actor,p_kind,p_payload-'pin',v_result);
  return v_result;
end;
$$;
revoke all on function private.preparation_command(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.preparation_command(uuid,uuid,text,jsonb) to authenticated;
create function public.preparation_command(
  p_command_id uuid,p_batch_id uuid,p_kind text,p_payload jsonb
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.preparation_command(p_command_id,p_batch_id,p_kind,p_payload);
$$;
revoke all on function public.preparation_command(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.preparation_command(uuid,uuid,text,jsonb) to authenticated;

-- Production selectors show prepared buckets instead of raw fruit once a
-- guide is approved. The insert trigger above also protects older clients.
create function private.production_terminal_snapshot_with_preparation() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_base jsonb; v_manager boolean;
begin
  v_base:=private.production_terminal_snapshot();
  v_manager:=exists(select 1 from public.staff_members where user_id=auth.uid()
    and active and role in ('admin','manager'));
  if not v_manager then return v_base; end if;
  return v_base || jsonb_build_object('lots',coalesce((select jsonb_agg(jsonb_build_object(
    'id',l.id,'code',l.code,'product_id',p.id,'product_name',p.name,
    'quantity',l.quantity,'unit',l.unit,'location_name',s.name,
    'prepared',l.preparation_batch_id is not null)
    order by l.expires_on nulls last,l.id)
    from public.lots l join public.item_variants v on v.id=l.variant_id
    join public.products p on p.id=v.product_id
    join public.categories c on c.id=p.category_id
    join public.storage_locations s on s.id=l.location_id
    where l.quantity>0 and v.active and p.active and c.active and s.active
      and (l.expires_on is null or l.expires_on>=(now() at time zone 'America/Sao_Paulo')::date)
      and (l.preparation_batch_id is not null or not exists (
        select 1 from public.preparation_guides g where g.product_id=p.id and g.status='approved'))),'[]'::jsonb));
end;
$$;
revoke all on function private.production_terminal_snapshot_with_preparation() from public,anon,authenticated;
grant execute on function private.production_terminal_snapshot_with_preparation() to authenticated;
create or replace function public.production_terminal_snapshot() returns jsonb
language sql security invoker set search_path = '' as $$
  select private.production_terminal_snapshot_with_preparation();
$$;
