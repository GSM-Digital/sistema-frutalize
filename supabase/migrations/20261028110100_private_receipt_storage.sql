-- Supabase Storage is platform-managed and not installed by standalone SQL replay.
-- On Supabase this creates a private, size/MIME-constrained bucket and policies.
create function private.receipt_object_allowed(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_parts text[]:=string_to_array(p_name,'/');
begin
  if private.operations_role() is distinct from 'admin' or array_length(v_parts,1)<>3
    or v_parts[2]<>auth.uid()::text or v_parts[1] !~ '^[a-f0-9-]{36}$'
    or v_parts[3] !~ '^[a-f0-9-]{36}\.(pdf|png|jpg|jpeg)$' then return false; end if;
  return exists(select 1 from public.receipts where id=v_parts[1]::uuid);
exception when invalid_text_representation then return false;
end; $$;
revoke all on function private.receipt_object_allowed(text) from public,anon;
grant execute on function private.receipt_object_allowed(text) to authenticated;

create function private.receipt_object_orphan(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.receipt_object_allowed(p_name) and not exists(select 1 from public.private_attachments where object_name=p_name);
$$;
revoke all on function private.receipt_object_orphan(text) from public,anon;
grant execute on function private.receipt_object_orphan(text) to authenticated;

do $$ begin
  if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
    execute $storage$insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values('frutalize-receipts','frutalize-receipts',false,10485760,array['image/jpeg','image/png','application/pdf'])
      on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types$storage$;
    execute $storage$create policy frutalize_receipts_insert on storage.objects for insert to authenticated
      with check(bucket_id='frutalize-receipts' and private.receipt_object_allowed(name))$storage$;
    execute $storage$create policy frutalize_receipts_read on storage.objects for select to authenticated
      using(bucket_id='frutalize-receipts' and (select public.can_manage_inventory()))$storage$;
    -- No update/upsert: evidence objects remain immutable after upload. Only
    -- unattached owner uploads older than a day are eligible for cleanup.
    execute $storage$create policy frutalize_receipts_orphan_cleanup on storage.objects for delete to authenticated
      using(bucket_id='frutalize-receipts' and private.receipt_object_orphan(name)
        and created_at < now()-interval '24 hours'
      )$storage$;
  end if;
end $$;
