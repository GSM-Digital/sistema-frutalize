create or replace function private.start_production(
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
  if v_lot.expires_on is not null
    and v_lot.expires_on < (now() at time zone 'America/Sao_Paulo')::date
  then
    raise exception 'Lotes vencidos não podem ser enviados para produção.';
  end if;
  perform 1
  from public.item_variants variant
  join public.products product on product.id = variant.product_id
  join public.categories category on category.id = product.category_id
  where variant.id = v_lot.variant_id
    and lower(trim(category.name)) in ('frutas', 'frutas recebidas');
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
