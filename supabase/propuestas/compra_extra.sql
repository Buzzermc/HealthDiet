-- Propuesta para un entorno de pruebas; no ejecutar en producción sin validar.
create table healthdiet_core.shopping_extras (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references healthdiet_core.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  checked boolean not null default false,
  created_at timestamptz not null default now()
);
alter table healthdiet_core.shopping_extras enable row level security;
revoke all on healthdiet_core.shopping_extras from public, anon, authenticated;
create index on healthdiet_core.shopping_extras (workspace_id, created_at, id);

create function healthdiet_private.extra_list() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare wid uuid := healthdiet_private.shopping_workspace();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'checked',e.checked) order by e.created_at,e.id) from healthdiet_core.shopping_extras e where e.workspace_id=wid),'[]'::jsonb);
end $$;
create function healthdiet_private.extra_add(p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare wid uuid := healthdiet_private.shopping_workspace();
begin
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then raise exception 'Nombre no válido'; end if;
  insert into healthdiet_core.shopping_extras (workspace_id,name) values (wid,btrim(p_name));
end $$;
create function healthdiet_private.extra_set(p_id uuid,p_checked boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare wid uuid := healthdiet_private.shopping_workspace();
begin
  if p_checked is null then raise exception 'Marca no válida'; end if;
  update healthdiet_core.shopping_extras set checked=p_checked where id=p_id and workspace_id=wid;
  if not found then raise exception 'Producto no disponible'; end if;
end $$;
create function healthdiet_private.extra_delete(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare wid uuid := healthdiet_private.shopping_workspace();
begin
  delete from healthdiet_core.shopping_extras where id=p_id and workspace_id=wid;
  if not found then raise exception 'Producto no disponible'; end if;
end $$;
create function public.hd_extra_list() returns jsonb language sql set search_path = '' as $$ select healthdiet_private.extra_list() $$;
create function public.hd_extra_add(p_name text) returns void language sql set search_path = '' as $$ select healthdiet_private.extra_add(p_name) $$;
create function public.hd_extra_set(p_id uuid,p_checked boolean) returns void language sql set search_path = '' as $$ select healthdiet_private.extra_set(p_id,p_checked) $$;
create function public.hd_extra_delete(p_id uuid) returns void language sql set search_path = '' as $$ select healthdiet_private.extra_delete(p_id) $$;
revoke all on function healthdiet_private.extra_list(),healthdiet_private.extra_add(text),healthdiet_private.extra_set(uuid,boolean),healthdiet_private.extra_delete(uuid) from public,anon,authenticated;
revoke all on function public.hd_extra_list(),public.hd_extra_add(text),public.hd_extra_set(uuid,boolean),public.hd_extra_delete(uuid) from public,anon,authenticated;
grant execute on function healthdiet_private.extra_list(),healthdiet_private.extra_add(text),healthdiet_private.extra_set(uuid,boolean),healthdiet_private.extra_delete(uuid) to authenticated;
grant execute on function public.hd_extra_list(),public.hd_extra_add(text),public.hd_extra_set(uuid,boolean),public.hd_extra_delete(uuid) to authenticated;
