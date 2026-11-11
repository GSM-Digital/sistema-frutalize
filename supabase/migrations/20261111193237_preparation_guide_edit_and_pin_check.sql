-- Keep draft instructions editable without approving them for physical work.
create function public.update_preparation_guide(p_guide_id uuid, p_steps jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_guide public.preparation_guides;
  v_step jsonb;
begin
  if not public.can_manage_inventory() then
    raise exception 'Acesso não autorizado.' using errcode='42501';
  end if;
  if p_guide_id is null or p_steps is null or jsonb_typeof(p_steps)<>'array'
    or jsonb_array_length(p_steps) not between 1 and 6 then
    raise exception 'Informe de uma a seis instruções.';
  end if;
  for v_step in select value from jsonb_array_elements(p_steps) loop
    if jsonb_typeof(v_step)<>'string' or length(trim(v_step#>>'{}')) not between 5 and 140 then
      raise exception 'Cada instrução precisa ter de 5 a 140 caracteres.';
    end if;
  end loop;
  select * into v_guide from public.preparation_guides
    where id=p_guide_id for update;
  if v_guide.id is null or v_guide.status<>'draft' then
    raise exception 'Somente rascunhos podem ser editados.';
  end if;
  update public.preparation_guides set steps=p_steps where id=p_guide_id;
  return jsonb_build_object('ok',true,'id',p_guide_id);
end;
$$;
revoke all on function public.update_preparation_guide(uuid,jsonb) from public,anon;
grant execute on function public.update_preparation_guide(uuid,jsonb) to authenticated;

-- Identifies a person before the operator enters the amount. The PIN is
-- checked again by the atomic start command, so this check grants no work.
create function public.verify_preparation_pin(p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid;
  v_error text;
  v_name text;
begin
  if not public.can_operate_production() then
    raise exception 'Acesso não autorizado.' using errcode='42501';
  end if;
  select user_id,error_code into v_user_id,v_error
    from private.preparation_pin_identity(p_pin);
  if v_error is not null then
    return jsonb_build_object('ok',false,'error',case when v_error='locked'
      then 'PIN temporariamente bloqueado. Aguarde um minuto.' else 'PIN inválido.' end);
  end if;
  select display_name into v_name from public.staff_members
    where user_id=v_user_id and active;
  if v_name is null then
    raise exception 'Operador inativo.';
  end if;
  return jsonb_build_object('ok',true,'name',v_name);
end;
$$;
revoke all on function public.verify_preparation_pin(text) from public,anon;
grant execute on function public.verify_preparation_pin(text) to authenticated;
