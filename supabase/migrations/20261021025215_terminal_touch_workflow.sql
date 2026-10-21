-- Persiste o ponto atual do terminal de produção. A estrutura detalhada do
-- procedimento continua versionada na aplicação; o banco guarda apenas o
-- checkpoint e os registros operacionais preenchidos durante a ordem.

alter table public.production_runs
  add column workflow_version smallint not null default 1
    check(workflow_version = 1),
  add column workflow_phase smallint not null default 1
    check(workflow_phase between 1 and 6),
  add column workflow_step smallint not null default 1
    check(workflow_step between 1 and 12),
  add column workflow_data jsonb not null default '{}'::jsonb
    check(jsonb_typeof(workflow_data) = 'object'),
  add column workflow_updated_at timestamptz not null default now();

create function private.save_production_progress(
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
      (select display_name from public.staff_members where user_id = auth.uid())
    );
  end if;
end;
$$;

revoke all on function private.save_production_progress(uuid, smallint, smallint, jsonb)
from public, anon;
grant execute on function private.save_production_progress(uuid, smallint, smallint, jsonb)
to authenticated;

create function public.save_production_progress(
  p_production_id uuid,
  p_phase smallint,
  p_step smallint,
  p_data jsonb
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.save_production_progress(
    p_production_id,
    p_phase,
    p_step,
    p_data
  );
$$;

revoke all on function public.save_production_progress(uuid, smallint, smallint, jsonb)
from public, anon;
grant execute on function public.save_production_progress(uuid, smallint, smallint, jsonb)
to authenticated;
