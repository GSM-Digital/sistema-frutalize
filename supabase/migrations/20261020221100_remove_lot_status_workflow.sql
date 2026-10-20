-- Remove o fluxo temporário de quarentena/liberação/bloqueio.
-- Lotes passam a ficar disponíveis imediatamente após o recebimento,
-- respeitando saldo e validade. Eventos antigos são preservados como histórico.

drop function if exists public.set_lot_status(uuid, uuid, text, text);
drop function if exists private.set_lot_status(uuid, uuid, text, text);

drop view public.inventory_lots;
drop function public.inventory_overview();

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

  if p_kind is null or p_kind not in ('dispatch', 'loss') then
    raise exception 'Tipo de movimentação inválido.';
  end if;
  if p_quantity is null
    or p_quantity <= 0
    or p_quantity > 999999999
    or p_quantity <> round(p_quantity, 3)
    or (v_lot.unit in ('un', 'pct', 'cx') and p_quantity <> trunc(p_quantity))
  then
    raise exception 'Quantidade inválida para a unidade do lote.';
  end if;
  if p_quantity > v_lot.quantity then raise exception 'Saldo insuficiente neste lote.'; end if;
  if p_operated_at is null
    or p_operated_at > now()
    or p_operated_at < v_lot.received_at
  then
    raise exception 'Data operacional fora do período do lote.';
  end if;
  if p_kind = 'dispatch'
    and v_lot.expires_on < (now() at time zone 'America/Sao_Paulo')::date
  then
    raise exception 'Saídas exigem um lote dentro da validade.';
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
    trim(p_reason),
    p_operated_at,
    (select display_name from public.staff_members where user_id = auth.uid())
  ) returning id into v_id;

  return v_id;
end;
$$;

-- Mantém as funções de recebimento existentes, alterando apenas a descrição
-- registrada no livro de movimentações.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('private.receive_lot(uuid,jsonb)'::regprocedure)
  into v_definition;
  execute replace(
    v_definition,
    'Recebimento em quarentena',
    'Recebimento de mercadoria'
  );

  select pg_get_functiondef('private.receive_delivery(uuid,jsonb)'::regprocedure)
  into v_definition;
  execute replace(
    v_definition,
    'Recebimento em quarentena',
    'Recebimento de mercadoria'
  );
end;
$$;

update public.stock_movements
set reason = 'Recebimento de mercadoria'
where kind = 'receipt' and reason = 'Recebimento em quarentena';

alter table public.stock_movements
  drop constraint stock_movements_kind_check,
  drop constraint stock_movements_check;

update public.stock_movements
set
  kind = 'note',
  reason = case kind
    when 'release' then 'Registro histórico de liberação: ' || reason
    when 'block' then 'Registro histórico de bloqueio: ' || reason
    else 'Registro histórico de quarentena: ' || reason
  end
where kind in ('release', 'block', 'quarantine');

alter table public.stock_movements
  add constraint stock_movements_kind_check
    check(kind in ('receipt', 'dispatch', 'loss', 'note')),
  add constraint stock_movements_quantity_kind_check
    check(
      (kind = 'receipt' and quantity > 0)
      or (kind in ('dispatch', 'loss') and quantity < 0)
      or (kind = 'note' and quantity = 0)
    );

alter table public.lots drop column status;

-- O local físico é arquivado para preservar lotes antigos, mas deixa de aparecer
-- em novos recebimentos e cadastros ativos.
update public.storage_locations
set active = false
where lower(trim(name)) = 'quarentena';

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
  concat_ws(
    ' ',
    l.code,
    p.name,
    case when v.is_default then null else v.name end,
    v.sku,
    s.name,
    f.name
  ) as search_text
from public.lots l
join public.item_variants v on v.id = l.variant_id
join public.products p on p.id = v.product_id
join public.storage_locations s on s.id = l.location_id
join public.suppliers f on f.id = l.supplier_id;

grant select on public.inventory_lots to authenticated;
revoke all on public.inventory_lots from anon;

create function public.inventory_overview()
returns table(
  products_count bigint,
  lots_count bigint,
  expiring_count bigint,
  expired_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select count(*) from public.products where active),
    count(*) filter(where quantity > 0),
    count(*) filter(
      where quantity > 0
        and expires_on between (now() at time zone 'America/Sao_Paulo')::date
          and (now() at time zone 'America/Sao_Paulo')::date + 30
    ),
    count(*) filter(
      where quantity > 0
        and expires_on < (now() at time zone 'America/Sao_Paulo')::date
    )
  from public.lots;
$$;

revoke all on function public.inventory_overview() from public, anon;
grant execute on function public.inventory_overview() to authenticated;
