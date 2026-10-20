-- Vincula o primeiro usuário administrativo criado no Supabase Auth.
-- A senha permanece exclusivamente no Auth e não é armazenada no repositório.
do $$
declare
  v_user_id uuid;
begin
  select id
    into v_user_id
    from auth.users
   where lower(email) = lower('admin@gmail.com');

  if v_user_id is null then
    raise exception 'O usuário administrativo admin@gmail.com não existe no Supabase Auth.';
  end if;

  insert into public.staff_members (user_id, display_name, role, active)
  values (v_user_id, 'Administrador Frutalize', 'admin', true)
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        role = excluded.role,
        active = excluded.active;
end;
$$;
