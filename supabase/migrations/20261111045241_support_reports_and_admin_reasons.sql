create table public.support_reports (
  id uuid primary key,
  author_id uuid not null default auth.uid() references auth.users(id),
  author_email text not null default coalesce(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'email',''),
  category text not null check (category in ('problem','suggestion','other')),
  description text not null check (length(trim(description)) between 1 and 4000),
  attachments text[] not null default '{}' check (
    cardinality(attachments) <= 5 and array_position(attachments,null) is null and
    array_to_string(attachments, ',') ~ '^([1-5]\.(png|jpg|webp)(,[1-5]\.(png|jpg|webp))*)?$'
  ),
  status text not null default 'todo' check (status in ('todo','in_progress','done','discarded')),
  created_at timestamptz not null default now()
);
create index support_reports_created_idx on public.support_reports(created_at, id);
create index support_reports_status_created_idx on public.support_reports(status, created_at, id);
alter table public.support_reports enable row level security;
revoke all on public.support_reports from public, anon, authenticated;
grant insert(id,category,description,attachments), select, update(status) on public.support_reports to authenticated;

create function private.can_report_support() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists(select 1 from public.staff_members where user_id=auth.uid() and active)
    or (not exists(select 1 from public.staff_members where user_id=auth.uid())
        and exists(select 1 from public.sales_customers where user_id=auth.uid()))
  );
$$;
revoke all on function private.can_report_support() from public, anon;
grant execute on function private.can_report_support() to authenticated;

create policy support_submit on public.support_reports for insert to authenticated
  with check (author_id=(select auth.uid()) and (select private.can_report_support()));
create policy support_admin_read on public.support_reports for select to authenticated
  using ((select public.can_manage_inventory()));
create policy support_admin_update on public.support_reports for update to authenticated
  using ((select public.can_manage_inventory())) with check ((select public.can_manage_inventory()));

create function private.support_staged_image(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_report_support()
    and split_part(p_name,'/',1)=auth.uid()::text
    and p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[1-5]\.(png|jpg|webp)$'
    and not exists(select 1 from public.support_reports
      where author_id=auth.uid() and id::text=split_part(p_name,'/',2));
$$;
revoke all on function private.support_staged_image(text) from public, anon;
grant execute on function private.support_staged_image(text) to authenticated;

do $$ begin
  if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
    execute $storage$insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values ('frutalize-support','frutalize-support',false,3670016,array['image/png','image/jpeg','image/webp'])$storage$;
    execute $storage$create policy support_images_insert on storage.objects for insert to authenticated
      with check (bucket_id='frutalize-support' and private.support_staged_image(name))$storage$;
    execute $storage$create policy support_images_read on storage.objects for select to authenticated
      using (bucket_id='frutalize-support' and ((select public.can_manage_inventory()) or private.support_staged_image(name)))$storage$;
    execute $storage$create policy support_images_cleanup on storage.objects for delete to authenticated
      using (bucket_id='frutalize-support' and private.support_staged_image(name))$storage$;
  end if;
end $$;

-- Keep the existing transaction, audit fields, and permission checks.
do $$
declare
  definition text := pg_get_functiondef('private.operations_command(uuid,text,text,jsonb)'::regprocedure);
  needle text := 'else private.operations_text(v_data,''reason'',3,240) end;';
begin
  if strpos(definition, needle)=0 then
    raise exception 'Validação de motivo da operação não encontrada.';
  end if;
  execute replace(definition, needle,
    'when v_role = ''admin'' and nullif(trim(v_data->>''reason''),'''') is null then ''Registro administrativo''
    else private.operations_text(v_data,''reason'',3,240) end;');
end $$;
