-- Every auth.users row needs a matching profiles row before the app can do
-- anything useful with that person — and there's no client-side path to
-- create one (profiles has no INSERT policy, on purpose: a person choosing
-- their own role would defeat the entire permission model). So the database
-- creates it automatically, defaulting to 'viewer' — the least access any
-- role has — and whoever administers the roster upgrades it afterward
-- (Table Editor -> profiles), by hand, deliberately not automatic.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, position, office_id, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    'Unassigned — set this in Table Editor',
    'OPAG',
    'viewer'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
