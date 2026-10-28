-- Production v2: approved, immutable instructions; authenticated operators;
-- one transaction per idempotent command. No sanitary defaults are seeded.
create function public.can_operate_production() returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.staff_members where user_id = auth.uid() and active);
$$;
revoke all on function public.can_operate_production() from public, anon;
grant execute on function public.can_operate_production() to authenticated;

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 2 and 120),
  type text not null check(type in ('pulper','filler','sealer','coder','scale','instrument','other')),
  manufacturer text not null default '' check(length(manufacturer) <= 120),
  model text not null default '' check(length(model) <= 120),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.packaging_specs (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 2 and 120),
  presentation_g numeric(14,3) not null check(presentation_g > 0 and presentation_g <= 999999),
  material text not null check(length(trim(material)) between 2 and 240),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.procedure_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  output_variant_id uuid not null references public.item_variants(id),
  name text not null check(length(trim(name)) between 2 and 120),
  revision integer not null check(revision > 0),
  status text not null default 'draft' check(status in ('draft','review','approved','retired')),
  approved_by uuid references auth.users(id), approved_at timestamptz,
  content_hash text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique(product_id,output_variant_id,revision),
  check(status not in ('approved','retired') or (approved_by is not null and approved_at is not null and content_hash is not null))
);
create table public.procedure_steps (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.procedure_versions(id),
  phase smallint not null check(phase between 1 and 6),
  step smallint not null check(step between 1 and 12),
  title text not null check(length(trim(title)) between 2 and 160),
  instruction text not null check(length(trim(instruction)) between 3 and 2000),
  kind text not null check(kind in ('confirm','quality','release','finish')),
  required boolean not null default true,
  unique(version_id,phase,step)
);
create table public.machine_profiles (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  output_variant_id uuid not null references public.item_variants(id),
  equipment_id uuid not null references public.equipment(id),
  packaging_id uuid not null references public.packaging_specs(id),
  name text not null check(length(trim(name)) between 2 and 120),
  revision integer not null check(revision > 0),
  status text not null default 'draft' check(status in ('draft','review','approved','retired')),
  parameters jsonb not null check(jsonb_typeof(parameters) = 'array' and jsonb_array_length(parameters) between 1 and 40),
  approved_by uuid references auth.users(id), approved_at timestamptz,
  content_hash text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique(product_id,output_variant_id,equipment_id,packaging_id,revision),
  check(status not in ('approved','retired') or (approved_by is not null and approved_at is not null and content_hash is not null))
);
create table public.quality_specs (
  id uuid primary key default gen_random_uuid(),
  output_variant_id uuid not null references public.item_variants(id),
  name text not null check(length(trim(name)) between 2 and 120),
  revision integer not null check(revision > 0),
  status text not null default 'draft' check(status in ('draft','review','approved','retired')),
  unit text not null check(unit in ('g','kg','l','un')),
  minimum numeric(14,6) not null check(minimum > 0),
  maximum numeric(14,6) not null check(maximum >= minimum and maximum <= 999999999),
  tare numeric(14,6) not null check(tare >= 0 and tare < maximum),
  requires_calibration boolean not null,
  approved_by uuid references auth.users(id), approved_at timestamptz,
  content_hash text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique(output_variant_id,revision),
  check(status not in ('approved','retired') or (approved_by is not null and approved_at is not null and content_hash is not null))
);
create table public.calibration_records (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id),
  calibrated_at timestamptz not null check(calibrated_at <= now()),
  valid_until timestamptz not null check(valid_until > calibrated_at),
  reference text not null check(length(trim(reference)) between 3 and 240),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index calibration_equipment_idx on public.calibration_records(equipment_id,valid_until desc);

alter table public.production_runs
  add column revision integer not null default 0 check(revision >= 0),
  add column operational_status text not null default 'preparing'
    check(operational_status in ('preparing','configured','in_progress','paused','awaiting_review','completed','cancelled')),
  add column procedure_version_id uuid references public.procedure_versions(id),
  add column machine_profile_id uuid references public.machine_profiles(id),
  add column quality_spec_id uuid references public.quality_specs(id),
  add column procedure_snapshot jsonb,
  add column profile_snapshot jsonb,
  add column quality_snapshot jsonb,
  add column operator_id uuid references auth.users(id),
  add column paused_at timestamptz,
  add column paused_seconds numeric not null default 0 check(paused_seconds >= 0),
  add column previous_operational_status text;
update public.production_runs set operational_status = 'completed' where status = 'completed';

create table public.production_run_events (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null unique,
  production_run_id uuid not null references public.production_runs(id),
  revision integer not null,
  actor_id uuid not null references auth.users(id),
  kind text not null,
  payload jsonb not null check(jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 32768),
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique(production_run_id,revision)
);
create table public.quality_checks (
  id uuid primary key default gen_random_uuid(),
  production_run_id uuid not null references public.production_runs(id),
  command_id uuid not null unique,
  spec_id uuid not null references public.quality_specs(id),
  spec_snapshot jsonb not null,
  phase smallint not null, step smallint not null,
  equipment_id uuid not null references public.equipment(id),
  calibration_id uuid references public.calibration_records(id),
  gross numeric(14,6) not null check(gross > 0),
  tare numeric(14,6) not null check(tare >= 0 and tare < gross),
  net numeric generated always as (gross-tare) stored,
  unit text not null,
  passed boolean not null,
  actor_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index quality_run_idx on public.quality_checks(production_run_id,created_at desc,id);
create table public.nonconformities (
  id uuid primary key default gen_random_uuid(),
  production_run_id uuid not null references public.production_runs(id),
  quality_check_id uuid references public.quality_checks(id),
  status text not null default 'open' check(status in ('open','contained','assessed','closed')),
  reason text not null check(length(trim(reason)) between 3 and 1000),
  decision text not null default '' check(length(decision) <= 1000),
  closed_by uuid references auth.users(id), closed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check(status <> 'closed' or (closed_by is not null and closed_at is not null and length(trim(decision)) >= 3))
);
create index nonconformities_run_idx on public.nonconformities(production_run_id,status);
create table private.production_catalog_commands (
  command_id uuid primary key, actor_id uuid not null,
  kind text not null, payload jsonb not null, result jsonb not null,
  created_at timestamptz not null default now()
);
revoke all on private.production_catalog_commands from public,anon,authenticated;

-- RLS is defense in depth. The terminal reads only the projected RPC below;
-- raw rows, inputs and inventory views with costs remain administrator-only.
do $$ declare t text; begin
  foreach t in array array['equipment','packaging_specs','procedure_versions','procedure_steps','machine_profiles','quality_specs','calibration_records','production_run_events','quality_checks','nonconformities'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy production_admin_read on public.%I for select to authenticated using ((select public.can_manage_inventory()))',t);
  end loop;
end $$;

create function private.production_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'Registro imutável: crie um novo evento ou versão.'; end;
$$;
revoke all on function private.production_append_only() from public,anon,authenticated;
create trigger production_event_immutable before update or delete on public.production_run_events
for each row execute function private.production_append_only();
create trigger quality_check_immutable before update or delete on public.quality_checks
for each row execute function private.production_append_only();
create trigger calibration_immutable before update or delete on public.calibration_records
for each row execute function private.production_append_only();
create trigger procedure_step_immutable before update or delete on public.procedure_steps
for each row execute function private.production_append_only();

create function private.production_step_insert_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.procedure_versions where id=new.version_id and status='draft') then
    raise exception 'Passos só podem ser incluídos no rascunho da nova versão.';
  end if;
  return new;
end;
$$;
revoke all on function private.production_step_insert_guard() from public,anon,authenticated;
create trigger procedure_step_insert_guard before insert on public.procedure_steps
for each row execute function private.production_step_insert_guard();

create function private.production_version_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Versões não podem ser removidas.'; end if;
  if (to_jsonb(new) - array['status','approved_by','approved_at','content_hash'])
    is distinct from (to_jsonb(old) - array['status','approved_by','approved_at','content_hash'])
    or not ((old.status = 'draft' and new.status = 'review')
      or (old.status = 'review' and new.status = 'approved')
      or (old.status = 'approved' and new.status = 'retired')) then
    raise exception 'Versão imutável ou transição de aprovação inválida.';
  end if;
  if old.status='approved' and (new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at or new.content_hash is distinct from old.content_hash) then
    raise exception 'A aprovação original da versão é imutável.';
  end if;
  return new;
end;
$$;
revoke all on function private.production_version_immutable() from public,anon,authenticated;
create trigger procedure_version_immutable before update or delete on public.procedure_versions
for each row execute function private.production_version_immutable();
create trigger profile_version_immutable before update or delete on public.machine_profiles
for each row execute function private.production_version_immutable();
create trigger quality_version_immutable before update or delete on public.quality_specs
for each row execute function private.production_version_immutable();

create function private.production_run_snapshot(p_run_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
select jsonb_build_object(
  'id',r.id,'code',r.code,'revision',r.revision,'status',r.status,
  'operational_status',r.operational_status,'phase',r.workflow_phase,'step',r.workflow_step,
  'operator_id',r.operator_id,'operator_name',m.display_name,'started_at',r.started_at,
  'paused_at',r.paused_at,'paused_seconds',r.paused_seconds,
  'procedure_id',r.procedure_version_id,'profile_id',r.machine_profile_id,'quality_spec_id',r.quality_spec_id,
  'procedure',r.procedure_snapshot,'profile',r.profile_snapshot,'qualitySpec',r.quality_snapshot,
  'output_variant_id',r.procedure_snapshot->>'output_variant_id','output_lot_id',r.output_lot_id,
  'updated_at',r.workflow_updated_at,
  'inputs',coalesce((select jsonb_agg(jsonb_build_object('lot_id',l.id,'code',l.code,
    'product_name',p.name,'quantity',i.quantity,'unit',i.unit) order by i.created_at,i.id)
    from public.production_inputs i join public.lots l on l.id=i.source_lot_id
    join public.item_variants v on v.id=l.variant_id join public.products p on p.id=v.product_id
    where i.production_run_id=r.id),'[]'::jsonb),
  'qualityChecks',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'net',q.net,'unit',q.unit,
    'passed',q.passed,'created_at',q.created_at,'instrument_name',e.name) order by q.created_at desc,q.id)
    from public.quality_checks q join public.equipment e on e.id=q.equipment_id
    where q.production_run_id=r.id),'[]'::jsonb),
  'nonconformities',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'status',n.status,
    'reason',n.reason,'decision',n.decision) order by n.created_at,n.id)
    from public.nonconformities n where n.production_run_id=r.id),'[]'::jsonb)
)
from public.production_runs r left join public.staff_members m on m.user_id=r.operator_id
where r.id=p_run_id;
$$;
revoke all on function private.production_run_snapshot(uuid) from public,anon,authenticated;

create function private.production_procedure_snapshot(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
select jsonb_build_object('id',p.id,'name',p.name,'revision',p.revision,'product_id',p.product_id,
  'output_variant_id',p.output_variant_id,'approved_by',p.approved_by,'approved_at',p.approved_at,
  'product_name',(select name from public.products where id=p.product_id),
  'output_variant_name',(select product.name||' · '||variant.name from public.item_variants variant
    join public.products product on product.id=variant.product_id where variant.id=p.output_variant_id),
  'content_hash',p.content_hash,'steps',coalesce((select jsonb_agg(jsonb_build_object('phase',s.phase,
    'step',s.step,'title',s.title,'instruction',s.instruction,'kind',s.kind,'required',s.required)
    order by s.phase,s.step) from public.procedure_steps s where s.version_id=p.id),'[]'::jsonb))
from public.procedure_versions p where p.id=p_id;
$$;
revoke all on function private.production_procedure_snapshot(uuid) from public,anon,authenticated;

create function private.production_admin_snapshot() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_manage_inventory() then raise exception 'Acesso não autorizado.' using errcode='42501'; end if;
  return jsonb_build_object(
    'equipment',coalesce((select jsonb_agg(to_jsonb(e) order by e.name,e.id) from public.equipment e),'[]'::jsonb),
    'packaging',coalesce((select jsonb_agg(to_jsonb(p) order by p.name,p.id) from public.packaging_specs p),'[]'::jsonb),
    'procedures',coalesce((select jsonb_agg(private.production_procedure_snapshot(p.id)||jsonb_build_object('status',p.status)
      order by p.name,p.revision desc) from public.procedure_versions p),'[]'::jsonb),
    'profiles',coalesce((select jsonb_agg(to_jsonb(p) order by p.name,p.revision desc) from public.machine_profiles p),'[]'::jsonb),
    'qualitySpecs',coalesce((select jsonb_agg(to_jsonb(q) order by q.name,q.revision desc) from public.quality_specs q),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name,p.id)
      from public.products p where p.active),'[]'::jsonb),
    'variants',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',p.name||' · '||v.name,
      'product_id',v.product_id,'sku',v.sku) order by p.name,v.name,v.id)
      from public.item_variants v join public.products p on p.id=v.product_id where v.active and p.active),'[]'::jsonb),
    'calibrations',coalesce((select jsonb_agg(to_jsonb(c) order by c.calibrated_at desc,c.id)
      from public.calibration_records c),'[]'::jsonb));
end;
$$;

create function private.production_command(
  p_command_id uuid,p_run_id uuid,p_expected_revision integer,p_kind text,p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid:=auth.uid(); v_manager boolean; v_event public.production_run_events;
  v_run public.production_runs; v_id uuid:=p_run_id; v_event_id uuid:=gen_random_uuid(); v_result jsonb;
  v_procedure public.procedure_versions; v_profile public.machine_profiles; v_quality public.quality_specs;
  v_step jsonb; v_next jsonb; v_item jsonb; v_lot public.lots; v_inputs jsonb;
  v_quantity numeric; v_movement uuid; v_input_product_found boolean:=false;
  v_gross numeric; v_tare numeric; v_passed boolean; v_check_id uuid; v_calibration uuid;
  v_nc public.nonconformities; v_reason text; v_status text; v_variant public.item_variants;
  v_product public.products; v_weight numeric; v_unit text; v_expiry date; v_cost numeric; v_output_id uuid;
  v_allowed text[];
begin
  if not public.can_operate_production() then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Seu acesso à produção não está ativo.');
  end if;
  if p_command_id is null or p_expected_revision is null or p_expected_revision<0 or p_kind is null
    or p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>32768 then
    raise exception 'Envelope de comando inválido.';
  end if;
  if exists(select 1 from jsonb_object_keys(p_payload) k where lower(k) ~ '(pin|password|senha|token|secret)') then
    raise exception 'Credenciais não podem ser registradas em eventos de produção.';
  end if;
  v_allowed:=case p_kind
    when 'create' then array['procedure_id','profile_id','quality_spec_id','inputs']
    when 'configure' then array['procedure_id','profile_id','quality_spec_id']
    when 'claim' then array['reason']
    when 'confirm_step' then array['phase','step']
    when 'quality_check' then array['gross','tare','unit','instrument_id']
    when 'pause' then array['reason','safe_point_confirmed']
    when 'resume' then array[]::text[]
    when 'issue' then array['reason']
    when 'resolve_nonconformity' then array['id','status','decision','reason']
    when 'complete' then array['location_id','quantity','unit','expires_on','notes','net_weight_kg','loss_notes']
    when 'cancel' then array['reason','disposition','destination']
    else null end;
  if v_allowed is null or exists(select 1 from jsonb_object_keys(p_payload) k where not(k=any(v_allowed))) then
    raise exception 'Comando ou campos de produção não reconhecidos.';
  end if;
  v_manager:=exists(select 1 from public.staff_members where user_id=v_actor and active and role in ('admin','manager'));
  -- Serialize duplicate intentions before locking the order. The saved response is
  -- returned verbatim, even after the order has moved on to another revision.
  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text,18));
  select * into v_event from public.production_run_events where command_id=p_command_id;
  if found then
    if v_event.actor_id<>v_actor or v_event.kind<>p_kind or v_event.payload<>p_payload
      or (p_run_id is not null and v_event.production_run_id<>p_run_id) then
      raise exception 'Identificador de comando já utilizado para outra intenção.';
    end if;
    return v_event.result;
  end if;

  if p_kind='create' then
    if not v_manager then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Somente um gestor pode abrir uma ordem.'); end if;
    if p_run_id is not null or p_expected_revision<>0 then raise exception 'Criação de ordem exige identificador vazio e revisão zero.'; end if;
    v_id:=gen_random_uuid();
    insert into public.production_runs(id,request_id,code,started_at)
    values(v_id,p_command_id,'PRD-'||to_char(now() at time zone 'America/Sao_Paulo','YYYYMMDD')||'-'||nextval('public.production_code_sequence'),now())
    returning * into v_run;
  else
    select * into v_run from public.production_runs where id=p_run_id for update;
    if not found then return jsonb_build_object('ok',false,'code','NOT_FOUND','message','Ordem não encontrada.'); end if;
    if v_run.revision<>p_expected_revision then
      return jsonb_build_object('ok',false,'code','CONFLICT','message','A ordem foi atualizada em outra tela. Confira o estado atual.',
        'currentRevision',v_run.revision,'snapshot',private.production_run_snapshot(v_run.id));
    end if;
    if v_run.status='completed' or v_run.operational_status in ('cancelled','completed') then
      return jsonb_build_object('ok',false,'code','INVALID_TRANSITION','message','Esta ordem está encerrada.');
    end if;
  end if;

  if p_kind in ('create','configure') then
    if not v_manager then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Configuração restrita à gestão.'); end if;
    if v_run.procedure_version_id is not null then raise exception 'Esta ordem já possui versões congeladas.'; end if;
    select * into v_procedure from public.procedure_versions where id=(p_payload->>'procedure_id')::uuid and status='approved' for share;
    if not found then raise exception 'Selecione um procedimento aprovado.'; end if;
    select * into v_profile from public.machine_profiles where id=(p_payload->>'profile_id')::uuid and status='approved'
      and product_id=v_procedure.product_id and output_variant_id=v_procedure.output_variant_id for share;
    if not found then raise exception 'Selecione um perfil aprovado e aplicável ao produto/apresentação.'; end if;
    perform 1 from public.equipment where id=v_profile.equipment_id and active for share;
    if not found then raise exception 'Equipamento do perfil indisponível.'; end if;
    perform 1 from public.packaging_specs where id=v_profile.packaging_id and active for share;
    if not found then raise exception 'Embalagem do perfil indisponível.'; end if;
    select * into v_quality from public.quality_specs where id=(p_payload->>'quality_spec_id')::uuid and status='approved'
      and output_variant_id=v_procedure.output_variant_id for share;
    if not found then raise exception 'Selecione uma regra de qualidade aprovada para a apresentação.'; end if;
    perform 1 from public.item_variants v join public.products p on p.id=v.product_id join public.categories c on c.id=p.category_id
      where v.id=v_procedure.output_variant_id and v.active and p.active and c.active and lower(trim(c.name))='polpas prontas';
    if not found then raise exception 'A apresentação de saída precisa ser uma polpa pronta ativa.'; end if;

    if p_kind='create' then
      if jsonb_typeof(p_payload->'inputs') is distinct from 'array' or jsonb_array_length(p_payload->'inputs') not between 1 and 40 then
        raise exception 'Informe de 1 a 40 lotes de insumos.';
      end if;
      if (select count(distinct value->>'lot_id') from jsonb_array_elements(p_payload->'inputs'))<>jsonb_array_length(p_payload->'inputs') then
        raise exception 'Informe cada lote uma única vez.';
      end if;
      -- Stable UUID ordering prevents deadlocks between orders sharing inputs.
      for v_item in select value from jsonb_array_elements(p_payload->'inputs') order by (value->>'lot_id')::uuid loop
        if jsonb_typeof(v_item)<>'object' or exists(select 1 from jsonb_object_keys(v_item) k where k not in ('lot_id','quantity')) then
          raise exception 'Insumo com campos não reconhecidos.';
        end if;
        select * into v_lot from public.lots where id=(v_item->>'lot_id')::uuid for update;
        if not found then raise exception 'Lote de insumo não encontrado.'; end if;
        v_quantity:=(v_item->>'quantity')::numeric;
        if v_quantity is null or v_quantity<=0 or v_quantity>999999999 or v_quantity<>round(v_quantity,3)
          or (v_lot.unit in ('un','pct','cx') and v_quantity<>trunc(v_quantity)) then raise exception 'Quantidade de insumo inválida.'; end if;
        if v_quantity>v_lot.quantity then raise exception 'Saldo insuficiente no lote %.',v_lot.code; end if;
        if v_lot.expires_on<(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Lote de insumo vencido.'; end if;
        perform 1 from public.storage_locations where id=v_lot.location_id and active for share;
        if not found then raise exception 'Local de insumo arquivado.'; end if;
        perform 1 from public.item_variants v join public.products p on p.id=v.product_id join public.categories c on c.id=p.category_id
          where v.id=v_lot.variant_id and v.active and p.active and c.active;
        if not found then raise exception 'Produto de insumo arquivado.'; end if;
        if exists(select 1 from public.item_variants where id=v_lot.variant_id and product_id=v_procedure.product_id) then v_input_product_found:=true; end if;
        update public.lots set quantity=quantity-v_quantity where id=v_lot.id;
        insert into public.stock_movements(request_id,lot_id,kind,quantity,balance_after,reason,operated_at,actor_name)
        values(gen_random_uuid(),v_lot.id,'production_input',-v_quantity,v_lot.quantity-v_quantity,'Consumo na ordem '||v_run.code,now(),
          (select display_name from public.staff_members where user_id=v_actor)) returning id into v_movement;
        insert into public.production_inputs(production_run_id,source_lot_id,movement_id,quantity,unit,input_cost)
        values(v_id,v_lot.id,v_movement,v_quantity,v_lot.unit,round(v_lot.unit_cost*v_quantity,2));
      end loop;
      if not v_input_product_found then raise exception 'O procedimento não corresponde a nenhum produto de origem.'; end if;
    elsif not exists(select 1 from public.production_inputs i join public.lots l on l.id=i.source_lot_id
      join public.item_variants v on v.id=l.variant_id where i.production_run_id=v_run.id and v.product_id=v_procedure.product_id) then
      raise exception 'O procedimento não corresponde à fruta da ordem legada.';
    end if;
    v_step:=(private.production_procedure_snapshot(v_procedure.id)->'steps')->0;
    update public.production_runs set procedure_version_id=v_procedure.id,machine_profile_id=v_profile.id,quality_spec_id=v_quality.id,
      procedure_snapshot=private.production_procedure_snapshot(v_procedure.id),
      profile_snapshot=to_jsonb(v_profile)-array['created_by','created_at','status'],
      quality_snapshot=to_jsonb(v_quality)-array['created_by','created_at','status'],
      workflow_phase=(v_step->>'phase')::smallint,workflow_step=(v_step->>'step')::smallint,
      operational_status='preparing',operator_id=null,workflow_data='{}'::jsonb
    where id=v_id;
  elsif p_kind='claim' then
    if v_run.operator_id is not null and v_run.operator_id<>v_actor and length(trim(coalesce(p_payload->>'reason','')))<3 then
      raise exception 'Informe o motivo da troca de responsável.';
    end if;
    update public.production_runs set operator_id=v_actor where id=v_id;
  elsif p_kind='resolve_nonconformity' then
    if not v_manager then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Somente a gestão pode decidir sobre desvios.'); end if;
    select * into v_nc from public.nonconformities where id=(p_payload->>'id')::uuid and production_run_id=v_id for update;
    if not found then raise exception 'Desvio não encontrado.'; end if;
    v_status:=p_payload->>'status'; v_reason:=trim(coalesce(p_payload->>'reason',''));
    if length(v_reason) not between 3 and 1000 or length(trim(coalesce(p_payload->>'decision',''))) not between 3 and 1000 then
      raise exception 'Informe decisão, destino e justificativa do desvio.';
    end if;
    if not ((v_nc.status='open' and v_status='contained') or (v_nc.status='contained' and v_status='assessed')
      or (v_nc.status='assessed' and v_status='closed')) then raise exception 'Sequência do desvio: aberto, contido, avaliado e encerrado.'; end if;
    update public.nonconformities set status=v_status,decision=trim(p_payload->>'decision')||' — '||v_reason,
      closed_by=case when v_status='closed' then v_actor else null end,closed_at=case when v_status='closed' then now() else null end where id=v_nc.id;
  elsif p_kind='cancel' then
    if not v_manager then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Cancelamento restrito à gestão.'); end if;
    if length(trim(coalesce(p_payload->>'reason',''))) not between 3 and 1000
      or length(trim(coalesce(p_payload->>'destination',''))) not between 3 and 240
      or coalesce(p_payload->>'disposition','') not in ('discarded','segregated') then
      raise exception 'Registre motivo, destino físico e disposição (descarte ou segregação). Devolução exige inventário compensatório separado.';
    end if;
    update public.production_runs set operational_status='cancelled',paused_at=null,
      paused_seconds=paused_seconds+case when paused_at is null then 0 else greatest(0,extract(epoch from now()-paused_at)) end
    where id=v_id;
  else
    if v_run.operator_id is distinct from v_actor then
      return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Assuma a ordem com sua própria conta antes de operar.');
    end if;
    if v_run.procedure_version_id is null then
      return jsonb_build_object('ok',false,'code','QUALITY_BLOCK','message','Esta ordem precisa de procedimento, perfil e regra aprovados.');
    end if;
    select value into v_step from jsonb_array_elements(v_run.procedure_snapshot->'steps')
      where (value->>'phase')::smallint=v_run.workflow_phase and (value->>'step')::smallint=v_run.workflow_step;
    if v_step is null then raise exception 'Checkpoint incompatível com a versão congelada.'; end if;
    case p_kind
      when 'quality_check' then
        if v_step->>'kind' not in ('quality','release') then raise exception 'O procedimento não solicita medição neste passo.'; end if;
        v_gross:=(p_payload->>'gross')::numeric; v_tare:=(p_payload->>'tare')::numeric;
        if v_gross is null or v_tare is null or v_gross<=0 or v_gross>999999999 or v_gross<>round(v_gross,6)
          or v_tare<0 or v_tare>=v_gross or v_tare<>round(v_tare,6)
          or p_payload->>'unit' is distinct from v_run.quality_snapshot->>'unit'
          or v_tare<>(v_run.quality_snapshot->>'tare')::numeric then
          raise exception 'Medição inválida: confira unidade e tara da regra congelada.';
        end if;
        perform 1 from public.equipment where id=(p_payload->>'instrument_id')::uuid and active and type in ('scale','instrument') for share;
        if not found then raise exception 'Selecione um instrumento ativo.'; end if;
        select id into v_calibration from public.calibration_records where equipment_id=(p_payload->>'instrument_id')::uuid
          and calibrated_at<=now() and valid_until>=now() order by calibrated_at desc,id limit 1;
        if (v_run.quality_snapshot->>'requires_calibration')::boolean and v_calibration is null then
          raise exception 'Instrumento sem calibração válida para esta regra.';
        end if;
        v_passed:=(v_gross-v_tare) between (v_run.quality_snapshot->>'minimum')::numeric and (v_run.quality_snapshot->>'maximum')::numeric;
        insert into public.quality_checks(production_run_id,command_id,spec_id,spec_snapshot,phase,step,equipment_id,calibration_id,gross,tare,unit,passed)
        values(v_id,p_command_id,v_run.quality_spec_id,v_run.quality_snapshot,v_run.workflow_phase,v_run.workflow_step,
          (p_payload->>'instrument_id')::uuid,v_calibration,v_gross,v_tare,p_payload->>'unit',v_passed) returning id into v_check_id;
        if not v_passed then
          insert into public.nonconformities(production_run_id,quality_check_id,reason)
          values(v_id,v_check_id,'Medição fora dos limites da regra de qualidade congelada.');
          update public.production_runs set previous_operational_status=case when operational_status='paused' then previous_operational_status else operational_status end,
            operational_status='paused',paused_at=coalesce(paused_at,now()) where id=v_id;
        end if;
      when 'confirm_step' then
        if v_run.operational_status in ('paused','awaiting_review') then raise exception 'Retome a ordem antes de confirmar um passo.'; end if;
        if (p_payload->>'phase')::integer is distinct from v_run.workflow_phase::integer
          or (p_payload->>'step')::integer is distinct from v_run.workflow_step::integer then raise exception 'Confirmação não corresponde ao passo atual.'; end if;
        if exists(select 1 from public.nonconformities where production_run_id=v_id and status<>'closed') then
          return jsonb_build_object('ok',false,'code','QUALITY_BLOCK','message','Há um desvio pendente de decisão da gestão.');
        end if;
        if v_step->>'kind' in ('quality','release') then
          select q.passed into v_passed from public.quality_checks q where q.production_run_id=v_id
            and (v_step->>'kind'='release' or (q.phase=v_run.workflow_phase and q.step=v_run.workflow_step)) order by q.created_at desc,q.id limit 1;
          if v_passed is distinct from true then
            return jsonb_build_object('ok',false,'code','QUALITY_BLOCK','message','Registre um teste conforme antes de liberar esta etapa.');
          end if;
        end if;
        select value into v_next from jsonb_array_elements(v_run.procedure_snapshot->'steps')
          where ((value->>'phase')::integer,(value->>'step')::integer)>(v_run.workflow_phase,v_run.workflow_step)
          order by (value->>'phase')::integer,(value->>'step')::integer limit 1;
        if v_next is null then
          if v_step->>'kind'<>'finish' then raise exception 'Procedimento sem passo final aprovado.'; end if;
          update public.production_runs set operational_status='awaiting_review' where id=v_id;
        else
          update public.production_runs set workflow_phase=(v_next->>'phase')::smallint,workflow_step=(v_next->>'step')::smallint,
            operational_status=case when v_step->>'kind'='release' then 'in_progress' when operational_status='preparing' then 'configured' else operational_status end
          where id=v_id;
        end if;
      when 'pause' then
        if v_run.operational_status in ('paused','awaiting_review') then raise exception 'A ordem já está pausada ou aguardando conferência.'; end if;
        v_reason:=trim(coalesce(p_payload->>'reason',''));
        if length(v_reason) not between 3 and 1000 or (p_payload->>'safe_point_confirmed')::boolean is distinct from true then
          raise exception 'Informe o motivo e confirme o ponto físico seguro definido no procedimento.';
        end if;
        update public.production_runs set previous_operational_status=operational_status,operational_status='paused',paused_at=now() where id=v_id;
      when 'resume' then
        if v_run.operational_status<>'paused' then raise exception 'A ordem não está pausada.'; end if;
        if exists(select 1 from public.nonconformities where production_run_id=v_id and status<>'closed') then
          return jsonb_build_object('ok',false,'code','QUALITY_BLOCK','message','A gestão precisa encerrar os desvios antes da retomada.');
        end if;
        update public.production_runs set operational_status=coalesce(previous_operational_status,'configured'),
          paused_seconds=paused_seconds+greatest(0,extract(epoch from now()-paused_at)),paused_at=null,previous_operational_status=null where id=v_id;
      when 'issue' then
        v_reason:=trim(coalesce(p_payload->>'reason',''));
        if length(v_reason) not between 3 and 1000 then raise exception 'Descreva o problema.'; end if;
        insert into public.nonconformities(production_run_id,reason) values(v_id,v_reason);
        update public.production_runs set previous_operational_status=case when operational_status='paused' then previous_operational_status else operational_status end,
          operational_status='paused',paused_at=coalesce(paused_at,now()) where id=v_id;
      when 'complete' then
        if v_run.operational_status<>'awaiting_review' then raise exception 'Conclua todos os passos do procedimento antes de finalizar.'; end if;
        if exists(select 1 from public.nonconformities where production_run_id=v_id and status<>'closed') then
          return jsonb_build_object('ok',false,'code','QUALITY_BLOCK','message','Desvio pendente impede finalizar a ordem.');
        end if;
        select passed into v_passed from public.quality_checks where production_run_id=v_id order by created_at desc,id limit 1;
        if v_passed is distinct from true then return jsonb_build_object('ok',false,'code','QUALITY_BLOCK','message','A última medição precisa estar conforme.'); end if;
        select * into v_variant from public.item_variants where id=(v_run.procedure_snapshot->>'output_variant_id')::uuid and active for share;
        if not found then raise exception 'Apresentação de saída indisponível.'; end if;
        select * into v_product from public.products where id=v_variant.product_id and active for share;
        if not found then raise exception 'Produto de saída indisponível.'; end if;
        perform 1 from public.storage_locations where id=(p_payload->>'location_id')::uuid and active and lower(trim(name)) like 'freezer %' for share;
        if not found then raise exception 'Selecione um freezer ativo.'; end if;
        v_quantity:=(p_payload->>'quantity')::numeric; v_unit:=p_payload->>'unit';
        if v_quantity is null or v_quantity<=0 or v_quantity>999999999 or v_quantity<>round(v_quantity,3)
          or v_unit is null or v_unit not in ('kg','g','l','un','pct','cx') or (v_unit in ('un','pct','cx') and v_quantity<>trunc(v_quantity)) then
          raise exception 'Quantidade ou unidade de saída inválida.';
        end if;
        v_expiry:=nullif(p_payload->>'expires_on','')::date;
        if (v_product.requires_expiry and v_expiry is null) or v_expiry<(now() at time zone 'America/Sao_Paulo')::date then
          raise exception 'Informe validade aprovada, igual ou posterior à fabricação.';
        end if;
        v_reason:=trim(coalesce(p_payload->>'notes',''));
        if length(v_reason)>1000 then raise exception 'Observação acima do limite permitido.'; end if;
        v_weight:=nullif(p_payload->>'net_weight_kg','')::numeric;
        if v_weight is not null and (v_weight<=0 or v_weight>999999999 or v_weight<>round(v_weight,6)) then raise exception 'Peso líquido inválido.'; end if;
        if v_unit='kg' then v_weight:=v_quantity; elsif v_unit='g' then v_weight:=v_quantity/1000;
        elsif v_unit='un' and v_variant.unit_weight_kg is not null then v_weight:=v_quantity*v_variant.unit_weight_kg; end if;
        select coalesce(sum(input_cost),0) into v_cost from public.production_inputs where production_run_id=v_id;
        insert into public.lots(production_run_id,code,variant_id,location_id,supplier_id,supplier_lot,reference,received_at,
          manufactured_on,expires_on,expiry_source,unit,initial_quantity,initial_weight_kg,total_cost,quantity,inspection_notes)
        values(v_id,v_run.code,v_variant.id,(p_payload->>'location_id')::uuid,null,'',v_run.code,now(),
          (now() at time zone 'America/Sao_Paulo')::date,v_expiry,case when v_expiry is null then 'not_applicable' else 'internal' end,
          v_unit,v_quantity,v_weight,v_cost,v_quantity,coalesce(nullif(v_reason,''),'Produção finalizada conforme procedimento aprovado')) returning id into v_output_id;
        insert into public.stock_movements(request_id,lot_id,kind,quantity,balance_after,reason,operated_at,actor_name)
        values(p_command_id,v_output_id,'production_output',v_quantity,v_quantity,'Finalização da ordem '||v_run.code,now(),
          (select display_name from public.staff_members where user_id=v_actor));
        update public.production_runs set status='completed',operational_status='completed',completed_at=now(),completed_by=v_actor,
          completion_request_id=p_command_id,output_lot_id=v_output_id where id=v_id;
      else raise exception 'Comando de produção não reconhecido.';
    end case;
  end if;
  update public.production_runs set revision=revision+1,workflow_updated_at=now() where id=v_id returning * into v_run;
  v_result:=jsonb_build_object('ok',true,'revision',v_run.revision,'eventId',v_event_id,'snapshot',private.production_run_snapshot(v_id));
  insert into public.production_run_events(id,command_id,production_run_id,revision,actor_id,kind,payload,result)
  values(v_event_id,p_command_id,v_id,v_run.revision,v_actor,p_kind,p_payload,v_result);
  insert into public.audit_events(entity,record_id,action,before_data,after_data,reason,created_by,actor_name)
  values('production_runs',v_id,'COMMAND_'||upper(p_kind),jsonb_build_object('revision',p_expected_revision),
    jsonb_build_object('revision',v_run.revision,'event_id',v_event_id,'operational_status',v_run.operational_status),
    coalesce(nullif(trim(p_payload->>'reason'),''),'Comando autenticado de produção'),v_actor,
    (select display_name from public.staff_members where user_id=v_actor));
  return v_result;
end;
$$;

create function private.production_terminal_snapshot() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_manager boolean;
begin
  if not public.can_operate_production() then raise exception 'Acesso não autorizado.' using errcode='42501'; end if;
  v_manager := exists(select 1 from public.staff_members where user_id=auth.uid() and active and role in ('admin','manager'));
  return jsonb_build_object(
    'actor',(select jsonb_build_object('id',user_id,'name',display_name,'role',role) from public.staff_members where user_id=auth.uid()),
    'serverTime',now(),
    'runs',coalesce((select jsonb_agg(private.production_run_snapshot(r.id) order by r.started_at,r.id)
      from public.production_runs r where r.status='in_progress' and r.operational_status <> 'cancelled'),'[]'::jsonb),
    'locations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id)
      from public.storage_locations where active and lower(trim(name)) like 'freezer %'),'[]'::jsonb),
    'instruments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id)
      from public.equipment where active and type in ('scale','instrument')),'[]'::jsonb),
    'procedures',coalesce((select jsonb_agg(private.production_procedure_snapshot(p.id) order by p.name,p.revision desc)
      from public.procedure_versions p where p.status='approved'),'[]'::jsonb),
    'profiles',coalesce((select jsonb_agg(to_jsonb(p)-array['created_by','created_at'] order by p.name,p.revision desc)
      from public.machine_profiles p where p.status='approved'),'[]'::jsonb),
    'qualitySpecs',coalesce((select jsonb_agg(to_jsonb(q)-array['created_by','created_at'] order by q.name,q.revision desc)
      from public.quality_specs q where q.status='approved'),'[]'::jsonb),
    'lots',case when v_manager then coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'code',l.code,
      'product_id',p.id,'product_name',p.name,'quantity',l.quantity,'unit',l.unit,'location_name',s.name)
      order by l.expires_on nulls last,l.id) from public.lots l join public.item_variants v on v.id=l.variant_id
      join public.products p on p.id=v.product_id join public.categories c on c.id=p.category_id
      join public.storage_locations s on s.id=l.location_id where l.quantity>0 and v.active and p.active and c.active and s.active
      and (l.expires_on is null or l.expires_on >= (now() at time zone 'America/Sao_Paulo')::date)),'[]'::jsonb) else '[]'::jsonb end);
end;
$$;

create function private.production_admin_command(p_command_id uuid,p_kind text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_cached private.production_catalog_commands; v_id uuid; v_step jsonb; v_param jsonb;
  v_result jsonb; v_table text; v_old jsonb; v_new jsonb; v_reason text; v_count integer;
begin
  if not public.can_manage_inventory() then raise exception 'Acesso não autorizado.' using errcode='42501'; end if;
  if p_command_id is null or p_kind is null or p_payload is null or jsonb_typeof(p_payload)<>'object'
    or pg_column_size(p_payload)>65536 then raise exception 'Comando de configuração inválido.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text,17));
  select * into v_cached from private.production_catalog_commands where command_id=p_command_id;
  if found then
    if v_cached.actor_id<>auth.uid() or v_cached.kind<>p_kind or v_cached.payload<>p_payload then
      raise exception 'Identificador de comando já utilizado para outra intenção.';
    end if;
    return v_cached.result;
  end if;
  v_id:=gen_random_uuid();
  case p_kind
    when 'save_equipment' then
      insert into public.equipment(id,name,type,manufacturer,model) values(v_id,trim(p_payload->>'name'),
        p_payload->>'type',coalesce(p_payload->>'manufacturer',''),coalesce(p_payload->>'model',''));
      v_table:='equipment';
    when 'save_packaging' then
      insert into public.packaging_specs(id,name,presentation_g,material) values(v_id,trim(p_payload->>'name'),
        (p_payload->>'presentation_g')::numeric,trim(p_payload->>'material'));
      v_table:='packaging_specs';
    when 'save_procedure' then
      if jsonb_typeof(p_payload->'steps') is distinct from 'array' or jsonb_array_length(p_payload->'steps') not between 1 and 72 then
        raise exception 'Informe de 1 a 72 passos do procedimento.';
      end if;
      insert into public.procedure_versions(id,name,product_id,output_variant_id,revision)
      values(v_id,trim(p_payload->>'name'),(p_payload->>'product_id')::uuid,(p_payload->>'output_variant_id')::uuid,(p_payload->>'revision')::integer);
      for v_step in select value from jsonb_array_elements(p_payload->'steps') loop
        if jsonb_typeof(v_step)<>'object' then raise exception 'Passo inválido.'; end if;
        insert into public.procedure_steps(version_id,phase,step,title,instruction,kind,required)
        values(v_id,(v_step->>'phase')::smallint,(v_step->>'step')::smallint,trim(v_step->>'title'),
          trim(v_step->>'instruction'),coalesce(v_step->>'kind','confirm'),coalesce((v_step->>'required')::boolean,true));
      end loop;
      v_table:='procedure_versions';
    when 'save_profile' then
      if jsonb_typeof(p_payload->'parameters') is distinct from 'array' or jsonb_array_length(p_payload->'parameters') not between 1 and 40 then
        raise exception 'Informe parâmetros com unidade, intervalo e origem.';
      end if;
      for v_param in select value from jsonb_array_elements(p_payload->'parameters') loop
        if jsonb_typeof(v_param)<>'object' or length(trim(coalesce(v_param->>'name',''))) not between 2 and 120
          or length(trim(coalesce(v_param->>'unit',''))) not between 1 and 30
          or length(trim(coalesce(v_param->>'source',''))) not between 3 and 240
          or (v_param->>'value')::numeric is null or (v_param->>'min')::numeric is null or (v_param->>'max')::numeric is null
          or (v_param->>'value')::numeric = 'NaN'::numeric or (v_param->>'min')::numeric = 'NaN'::numeric or (v_param->>'max')::numeric = 'NaN'::numeric
          or abs((v_param->>'value')::numeric)>999999999 or abs((v_param->>'min')::numeric)>999999999 or abs((v_param->>'max')::numeric)>999999999
          or (v_param->>'value')::numeric not between (v_param->>'min')::numeric and (v_param->>'max')::numeric then
          raise exception 'Parâmetro sem unidade/origem ou fora do intervalo aprovado.';
        end if;
      end loop;
      insert into public.machine_profiles(id,name,product_id,output_variant_id,equipment_id,packaging_id,revision,parameters)
      values(v_id,trim(p_payload->>'name'),(p_payload->>'product_id')::uuid,(p_payload->>'output_variant_id')::uuid,
        (p_payload->>'equipment_id')::uuid,(p_payload->>'packaging_id')::uuid,(p_payload->>'revision')::integer,p_payload->'parameters');
      v_table:='machine_profiles';
    when 'save_quality_spec' then
      insert into public.quality_specs(id,name,output_variant_id,revision,unit,minimum,maximum,tare,requires_calibration)
      values(v_id,trim(p_payload->>'name'),(p_payload->>'output_variant_id')::uuid,(p_payload->>'revision')::integer,
        p_payload->>'unit',(p_payload->>'minimum')::numeric,(p_payload->>'maximum')::numeric,(p_payload->>'tare')::numeric,
        (p_payload->>'requires_calibration')::boolean);
      v_table:='quality_specs';
    when 'calibrate' then
      insert into public.calibration_records(id,equipment_id,calibrated_at,valid_until,reference)
      values(v_id,(p_payload->>'equipment_id')::uuid,(p_payload->>'calibrated_at')::timestamptz,
        (p_payload->>'valid_until')::timestamptz,trim(p_payload->>'reference'));
      v_table:='calibration_records';
    when 'review','approve','retire' then
      v_id:=(p_payload->>'id')::uuid;
      v_table:=case p_payload->>'entity' when 'procedure' then 'procedure_versions' when 'profile' then 'machine_profiles' when 'quality' then 'quality_specs' end;
      if v_table is null then raise exception 'Versão inválida.'; end if;
      v_reason:=trim(coalesce(p_payload->>'reason',''));
      if length(v_reason) not between 3 and 240 then raise exception 'Informe motivo e referência da aprovação.'; end if;
      execute format('select to_jsonb(v) from public.%I v where id=$1 for update',v_table) into v_old using v_id;
      if v_old is null then raise exception 'Versão não encontrada.'; end if;
      if p_kind='approve' and v_table='procedure_versions' then
        select count(*) into v_count from public.procedure_steps where version_id=v_id;
        if v_count=0 or not exists(select 1 from public.procedure_steps where version_id=v_id and kind='quality')
          or not exists(select 1 from public.procedure_steps where version_id=v_id and kind='release')
          or not exists(select 1 from public.procedure_steps where version_id=v_id and kind='finish') then
          raise exception 'Procedimento exige passos de qualidade, liberação e finalização.';
        end if;
        if exists(select 1 from (select phase,step,row_number() over(partition by phase order by step) n
          from public.procedure_steps where version_id=v_id) s where s.step<>s.n) then
          raise exception 'Os passos de cada fase devem ser sequenciais, iniciando em 1.';
        end if;
        if (select kind from public.procedure_steps where version_id=v_id order by phase desc,step desc limit 1)<>'finish'
          or exists(select 1 from public.procedure_steps where version_id=v_id and kind='finish' and
            (phase,step)<>(select phase,step from public.procedure_steps where version_id=v_id order by phase desc,step desc limit 1)) then
          raise exception 'A finalização deve ser o último passo do procedimento.';
        end if;
      end if;
      execute format('update public.%I set status=$2,approved_by=case when $2=''approved'' then $3 else approved_by end,
        approved_at=case when $2=''approved'' then now() else approved_at end,
        content_hash=case when $2=''approved'' then md5($4::text) else content_hash end where id=$1 returning to_jsonb(%I.*)',v_table,v_table)
        into v_new using v_id,case p_kind when 'review' then 'review' when 'approve' then 'approved' else 'retired' end,auth.uid(),
          case when v_table='procedure_versions' then private.production_procedure_snapshot(v_id) else v_old end;
    else raise exception 'Comando de configuração não reconhecido.';
  end case;
  if v_new is null then execute format('select to_jsonb(v) from public.%I v where id=$1',v_table) into v_new using v_id; end if;
  insert into public.audit_events(entity,record_id,action,before_data,after_data,reason,created_by,actor_name)
  values(v_table,v_id,upper(p_kind),v_old,v_new,coalesce(v_reason,'Cadastro de configuração de produção'),auth.uid(),
    (select display_name from public.staff_members where user_id=auth.uid()));
  v_result:=jsonb_build_object('ok',true,'id',v_id);
  insert into private.production_catalog_commands(command_id,actor_id,kind,payload,result)
  values(p_command_id,auth.uid(),p_kind,p_payload,v_result);
  return v_result;
end;
$$;

-- Disable the mutable checkpoint bypass. Existing rows are retained and can be
-- explicitly configured with approved versions; no automatic POP backfill.
create or replace function private.save_production_progress(p_production_id uuid,p_phase smallint,p_step smallint,p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_inventory() then raise exception 'Acesso não autorizado.' using errcode='42501'; end if;
  raise exception 'Abra o novo terminal e configure versões aprovadas. O checkpoint legado está desativado.';
end;
$$;
alter function private.complete_production(uuid,uuid,jsonb) rename to complete_production_legacy;
revoke all on function private.complete_production_legacy(uuid,uuid,jsonb) from public,anon,authenticated;
create function private.complete_production(p_request_id uuid,p_production_id uuid,p_data jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_inventory() then raise exception 'Acesso não autorizado.' using errcode='42501'; end if;
  raise exception 'Finalize pelo novo terminal com procedimento e qualidade aprovados.';
end;
$$;
-- The SQL wrapper is recreated because SQL function OIDs may retain bindings
-- to the renamed implementation in existing installations.
create or replace function public.complete_production(p_request_id uuid,p_production_id uuid,p_data jsonb)
returns uuid language sql security invoker set search_path = '' as $$
  select private.complete_production(p_request_id,p_production_id,p_data);
$$;
-- Old PIN assignment cannot mutate a v2 order outside the revision protocol.
alter function private.claim_production_run(uuid,text) rename to claim_production_run_legacy;
revoke all on function private.claim_production_run_legacy(uuid,text) from public,anon,authenticated;
create function private.claim_production_run(p_production_id uuid,p_pin text)
returns table(operator_id uuid,operator_name text,responsibility_started_at timestamptz,error_code text)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_inventory() then raise exception 'Acesso não autorizado.' using errcode='42501'; end if;
  raise exception 'Assuma a ordem pelo novo terminal com seu próprio login.';
end;
$$;
create or replace function public.claim_production_run(p_production_id uuid,p_pin text)
returns table(operator_id uuid,operator_name text,responsibility_started_at timestamptz,error_code text)
language sql security invoker set search_path = '' as $$
  select * from private.claim_production_run(p_production_id,p_pin);
$$;

revoke all on function private.production_admin_snapshot(),private.production_terminal_snapshot(),
  private.production_admin_command(uuid,text,jsonb),private.production_command(uuid,uuid,integer,text,jsonb),
  private.complete_production(uuid,uuid,jsonb),private.claim_production_run(uuid,text)
from public,anon,authenticated;
grant execute on function private.production_admin_snapshot(),private.production_terminal_snapshot(),
  private.production_admin_command(uuid,text,jsonb),private.production_command(uuid,uuid,integer,text,jsonb),
  private.complete_production(uuid,uuid,jsonb),private.claim_production_run(uuid,text)
to authenticated;
create function public.production_admin_snapshot() returns jsonb language sql security invoker set search_path = '' as $$
  select private.production_admin_snapshot();
$$;
create function public.production_terminal_snapshot() returns jsonb language sql security invoker set search_path = '' as $$
  select private.production_terminal_snapshot();
$$;
create function public.production_admin_command(p_command_id uuid,p_kind text,p_payload jsonb) returns jsonb
language sql security invoker set search_path = '' as $$ select private.production_admin_command(p_command_id,p_kind,p_payload); $$;
create function public.production_command(p_command_id uuid,p_run_id uuid,p_expected_revision integer,p_kind text,p_payload jsonb) returns jsonb
language sql security invoker set search_path = '' as $$ select private.production_command(p_command_id,p_run_id,p_expected_revision,p_kind,p_payload); $$;
revoke all on function public.production_admin_snapshot(),public.production_terminal_snapshot(),
  public.production_admin_command(uuid,text,jsonb),public.production_command(uuid,uuid,integer,text,jsonb) from public,anon;
grant execute on function public.production_admin_snapshot(),public.production_terminal_snapshot(),
  public.production_admin_command(uuid,text,jsonb),public.production_command(uuid,uuid,integer,text,jsonb) to authenticated;

