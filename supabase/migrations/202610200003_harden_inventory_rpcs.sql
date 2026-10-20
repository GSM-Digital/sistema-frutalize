-- Mantém a API pública estável, mas isola as implementações SECURITY DEFINER
-- em um schema que não é exposto pelo PostgREST.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Esta verificação só lê o registro do próprio usuário, permitido pela RLS.
alter function public.can_manage_inventory() security invoker;

-- Função de evento criada pela plataforma: sua execução direta não é necessária.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

-- Funções futuras não serão executáveis por PUBLIC sem concessão explícita.
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

alter function public.audit_catalog_change() set schema private;
alter function public.save_catalog(text, uuid, jsonb, text) set schema private;
alter function public.receive_lot(uuid, jsonb) set schema private;
alter function public.move_stock(uuid, uuid, text, numeric, text, timestamptz) set schema private;
alter function public.set_lot_status(uuid, uuid, text, text) set schema private;

revoke all on function private.audit_catalog_change() from public, anon, authenticated;
revoke all on function private.save_catalog(text, uuid, jsonb, text),
  private.receive_lot(uuid, jsonb),
  private.move_stock(uuid, uuid, text, numeric, text, timestamptz),
  private.set_lot_status(uuid, uuid, text, text)
from public, anon;

grant execute on function private.save_catalog(text, uuid, jsonb, text),
  private.receive_lot(uuid, jsonb),
  private.move_stock(uuid, uuid, text, numeric, text, timestamptz),
  private.set_lot_status(uuid, uuid, text, text)
to authenticated;

create function public.save_catalog(p_entity text, p_id uuid, p_values jsonb, p_reason text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.save_catalog(p_entity, p_id, p_values, p_reason);
$$;

create function public.receive_lot(p_request_id uuid, p_data jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.receive_lot(p_request_id, p_data);
$$;

create function public.move_stock(
  p_request_id uuid,
  p_lot_id uuid,
  p_kind text,
  p_quantity numeric,
  p_reason text,
  p_operated_at timestamptz
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.move_stock(p_request_id, p_lot_id, p_kind, p_quantity, p_reason, p_operated_at);
$$;

create function public.set_lot_status(p_request_id uuid, p_lot_id uuid, p_status text, p_reason text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.set_lot_status(p_request_id, p_lot_id, p_status, p_reason);
$$;

revoke all on function public.save_catalog(text, uuid, jsonb, text),
  public.receive_lot(uuid, jsonb),
  public.move_stock(uuid, uuid, text, numeric, text, timestamptz),
  public.set_lot_status(uuid, uuid, text, text)
from public, anon;

grant execute on function public.save_catalog(text, uuid, jsonb, text),
  public.receive_lot(uuid, jsonb),
  public.move_stock(uuid, uuid, text, numeric, text, timestamptz),
  public.set_lot_status(uuid, uuid, text, text)
to authenticated;
