-- Identificação operacional no terminal compartilhado. O PIN não substitui a
-- autenticação administrativa: ele atribui uma ordem a um colaborador ativo.
create extension if not exists pgcrypto with schema extensions;

alter table public.staff_members
  add column production_pin_hash text;

-- O hash nunca deve ser retornado pela Data API, nem mesmo ao próprio usuário.
revoke select on public.staff_members from authenticated;
grant select(user_id, display_name, role, active, created_at)
on public.staff_members to authenticated;

create table private.production_pin_attempts (
  authenticated_user_id uuid primary key,
  failed_attempts smallint not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz
);

revoke all on private.production_pin_attempts
from public, anon, authenticated;

create function private.set_own_production_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not public.can_manage_inventory() then
    raise exception 'Acesso não autorizado.' using errcode = '42501';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'O PIN deve ter quatro números.';
  end if;
  if exists (
    select 1
    from public.staff_members member
    where member.active
      and member.user_id <> v_user_id
      and member.production_pin_hash is not null
      and extensions.crypt(p_pin, member.production_pin_hash)
        = member.production_pin_hash
  ) then
    raise exception 'Este PIN já pertence a outro colaborador.';
  end if;

  update public.staff_members
  set production_pin_hash = extensions.crypt(
    p_pin,
    extensions.gen_salt('bf', 10)
  )
  where user_id = v_user_id and active;

  if not found then raise exception 'Colaborador não encontrado.'; end if;

  delete from private.production_pin_attempts
  where authenticated_user_id = v_user_id;

  insert into public.audit_events(
    entity, record_id, action, before_data, after_data, reason,
    created_by, actor_name
  ) values(
    'staff_members',
    v_user_id,
    'PRODUCTION_PIN_UPDATED',
    null,
    jsonb_build_object('configured', true),
    'PIN operacional atualizado',
    v_user_id,
    (select display_name from public.staff_members where user_id = v_user_id)
  );
end;
$$;

create function private.claim_production_run(
  p_production_id uuid,
  p_pin text
)
returns table(
  operator_id uuid,
  operator_name text,
  responsibility_started_at timestamptz,
  error_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_authenticated_user_id uuid := auth.uid();
  v_attempt private.production_pin_attempts;
  v_operator public.staff_members;
  v_run public.production_runs;
  v_previous_id uuid;
  v_previous_name text;
  v_started_at timestamptz;
  v_failed_attempts smallint;
begin
  if not public.can_manage_inventory() then
    raise exception 'Acesso não autorizado.' using errcode = '42501';
  end if;
  if p_production_id is null then raise exception 'Produção obrigatória.'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'O PIN deve ter quatro números.';
  end if;

  insert into private.production_pin_attempts(authenticated_user_id)
  values(v_authenticated_user_id)
  on conflict(authenticated_user_id) do nothing;

  select * into v_attempt
  from private.production_pin_attempts
  where authenticated_user_id = v_authenticated_user_id
  for update;

  if v_attempt.locked_until is not null
    and v_attempt.locked_until > now()
  then
    return query select null::uuid, null::text, null::timestamptz, 'locked'::text;
    return;
  end if;

  if v_attempt.window_started_at < now() - interval '5 minutes' then
    update private.production_pin_attempts
    set failed_attempts = 0,
      window_started_at = now(),
      locked_until = null
    where authenticated_user_id = v_authenticated_user_id;
    v_attempt.failed_attempts := 0;
  end if;

  select member.* into v_operator
  from public.staff_members member
  where member.active
    and member.production_pin_hash is not null
    and extensions.crypt(p_pin, member.production_pin_hash)
      = member.production_pin_hash
  order by member.created_at, member.user_id
  limit 1;

  if not found then
    v_failed_attempts := v_attempt.failed_attempts + 1;
    update private.production_pin_attempts
    set failed_attempts = v_failed_attempts,
      locked_until = case
        when v_failed_attempts >= 5 then now() + interval '1 minute'
        else null
      end
    where authenticated_user_id = v_authenticated_user_id;
    return query select
      null::uuid,
      null::text,
      null::timestamptz,
      case when v_failed_attempts >= 5 then 'locked' else 'invalid' end;
    return;
  end if;

  select * into v_run
  from public.production_runs
  where id = p_production_id
  for update;

  if not found then raise exception 'Produção não encontrada.'; end if;
  if v_run.status <> 'in_progress' then
    raise exception 'Esta produção já foi finalizada.';
  end if;

  begin
    v_previous_id := nullif(
      v_run.workflow_data->>'responsibleOperatorId', ''
    )::uuid;
  exception when invalid_text_representation then
    v_previous_id := null;
  end;
  v_previous_name := v_run.workflow_data->>'responsibleOperatorName';
  v_started_at := case
    when v_previous_id = v_operator.user_id then coalesce(
      (v_run.workflow_data->>'responsibilityStartedAt')::timestamptz,
      now()
    )
    else now()
  end;

  update public.production_runs
  set workflow_data = jsonb_set(
        jsonb_set(
          jsonb_set(
            workflow_data,
            '{responsibleOperatorId}',
            to_jsonb(v_operator.user_id::text),
            true
          ),
          '{responsibleOperatorName}',
          to_jsonb(v_operator.display_name),
          true
        ),
        '{responsibilityStartedAt}',
        to_jsonb(v_started_at),
        true
      ),
      workflow_updated_at = now()
  where id = p_production_id;

  delete from private.production_pin_attempts
  where authenticated_user_id = v_authenticated_user_id;

  if v_previous_id is distinct from v_operator.user_id then
    insert into public.audit_events(
      entity, record_id, action, before_data, after_data, reason,
      created_by, actor_name
    ) values(
      'production_runs',
      p_production_id,
      'PRODUCTION_RESPONSIBLE',
      jsonb_build_object(
        'operator_id', v_previous_id,
        'operator_name', v_previous_name
      ),
      jsonb_build_object(
        'operator_id', v_operator.user_id,
        'operator_name', v_operator.display_name,
        'responsibility_started_at', v_started_at
      ),
      case
        when v_previous_id is null then 'Responsável assumiu a produção'
        else 'Troca do responsável pela produção'
      end,
      v_authenticated_user_id,
      v_operator.display_name
    );
  end if;

  return query select
    v_operator.user_id,
    v_operator.display_name,
    v_started_at,
    null::text;
end;
$$;

create or replace function private.save_production_progress(
  p_production_id uuid,
  p_phase smallint,
  p_step smallint,
  p_data jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.production_runs;
  v_responsible_id uuid;
begin
  if not public.can_manage_inventory() then
    raise exception 'Acesso não autorizado.' using errcode = '42501';
  end if;
  if p_production_id is null then
    raise exception 'Produção obrigatória.';
  end if;
  if p_phase is null or p_phase not between 1 and 6 then
    raise exception 'Fase de produção inválida.';
  end if;
  if p_step is null or p_step not between 1 and 12 then
    raise exception 'Passo de produção inválido.';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object'
    or pg_column_size(p_data) > 32768
  then
    raise exception 'Dados do terminal inválidos.';
  end if;

  select * into v_run
  from public.production_runs
  where id = p_production_id
  for update;

  if not found then raise exception 'Produção não encontrada.'; end if;
  if v_run.status <> 'in_progress' then
    raise exception 'Esta produção já foi finalizada.';
  end if;

  begin
    v_responsible_id := nullif(
      v_run.workflow_data->>'responsibleOperatorId', ''
    )::uuid;
  exception when invalid_text_representation then
    v_responsible_id := null;
  end;

  if v_responsible_id is null then
    raise exception 'Identifique o responsável antes de continuar.';
  end if;
  if p_data->>'responsibleOperatorId' is distinct from v_responsible_id::text
    or p_data->>'responsibleOperatorName'
      is distinct from v_run.workflow_data->>'responsibleOperatorName'
  then
    raise exception 'O responsável só pode ser alterado com o PIN.';
  end if;

  update public.production_runs
  set
    workflow_phase = p_phase,
    workflow_step = p_step,
    workflow_data = p_data,
    workflow_updated_at = now()
  where id = p_production_id;

  if v_run.workflow_phase <> p_phase then
    insert into public.audit_events(
      entity, record_id, action, before_data, after_data, reason,
      created_by, actor_name
    ) values(
      'production_runs',
      p_production_id,
      'WORKFLOW_PHASE',
      jsonb_build_object(
        'phase', v_run.workflow_phase,
        'step', v_run.workflow_step
      ),
      jsonb_build_object('phase', p_phase, 'step', p_step),
      'Avanço no terminal de produção',
      auth.uid(),
      v_run.workflow_data->>'responsibleOperatorName'
    );
  end if;
end;
$$;

revoke all on function private.set_own_production_pin(text),
  private.claim_production_run(uuid, text)
from public, anon, authenticated;
grant execute on function private.set_own_production_pin(text),
  private.claim_production_run(uuid, text)
to authenticated;

create function public.set_own_production_pin(p_pin text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_own_production_pin(p_pin);
$$;

create function public.claim_production_run(
  p_production_id uuid,
  p_pin text
)
returns table(
  operator_id uuid,
  operator_name text,
  responsibility_started_at timestamptz,
  error_code text
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.claim_production_run(p_production_id, p_pin);
$$;

revoke all on function public.set_own_production_pin(text),
  public.claim_production_run(uuid, text)
from public, anon;
grant execute on function public.set_own_production_pin(text),
  public.claim_production_run(uuid, text)
to authenticated;
