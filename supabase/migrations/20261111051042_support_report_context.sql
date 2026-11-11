alter table public.support_reports
  add column author_name text,
  add column source_path text check (
    length(source_path) <= 500 and
    source_path ~ '^/(dashboard|terminal|gestao|portal)(/[a-zA-Z0-9_-]+)*/?$'
  );

grant insert(source_path) on public.support_reports to authenticated;

-- Snapshot the name from the authenticated author's existing profile.
create function private.set_support_report_author_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.author_name := coalesce(
    (select nullif(trim(display_name),'') from public.staff_members where user_id=new.author_id),
    (select nullif(trim(name),'') from public.sales_customers where user_id=new.author_id)
  );
  return new;
end;
$$;
revoke all on function private.set_support_report_author_name() from public, anon, authenticated;

create trigger support_report_author_name
before insert on public.support_reports
for each row execute function private.set_support_report_author_name();

-- Prior reports can recover the current name, but their origin was never stored.
update public.support_reports report
set author_name = coalesce(
  (select nullif(trim(display_name),'') from public.staff_members where user_id=report.author_id),
  (select nullif(trim(name),'') from public.sales_customers where user_id=report.author_id)
);
