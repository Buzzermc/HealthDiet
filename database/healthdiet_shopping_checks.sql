create table healthdiet_core.shopping_checks (
 workspace_id uuid not null references healthdiet_core.workspaces(id) on delete cascade,
 ingredient_key text not null check(length(ingredient_key) between 3 and 150),
 primary key(workspace_id,ingredient_key)
);
alter table healthdiet_core.shopping_checks enable row level security;
revoke all on healthdiet_core.shopping_checks from public, anon, authenticated;

create or replace function healthdiet_private.shopping_workspace()
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=healthdiet_private.verified_user(); wid uuid;
begin
 select workspace_id into wid from healthdiet_core.members where user_id=uid and left_at is null;
 if wid is null then raise exception 'Se necesita un espacio activo.' using errcode='42501'; end if;
 perform 1 from healthdiet_core.workspaces where id=wid for update;
 if not exists(select 1 from healthdiet_core.members where workspace_id=wid and user_id=uid and left_at is null)
 then raise exception 'Ya no perteneces al espacio.' using errcode='42501'; end if;
 return wid;
end $$;

create or replace function healthdiet_private.shopping_read()
returns jsonb language plpgsql security definer set search_path='' as $$
declare wid uuid:=healthdiet_private.shopping_workspace(); mid uuid;
begin
 select id into mid from healthdiet_core.menus where workspace_id=wid and active;
 return jsonb_build_object('menu_id',mid,'checked',coalesce((select jsonb_agg(ingredient_key order by ingredient_key) from healthdiet_core.shopping_checks where workspace_id=wid),'[]'::jsonb));
end $$;

create or replace function healthdiet_private.shopping_set(p_menu_id uuid,p_name text,p_unit text,p_checked boolean)
returns void language plpgsql security definer set search_path='' as $$
declare wid uuid:=healthdiet_private.shopping_workspace(); k text:=lower(btrim(p_name))||'|'||p_unit;
begin
 if p_checked is null or not exists(
  select 1 from healthdiet_core.menus m join healthdiet_core.menu_recipes mr on mr.menu_id=m.id and mr.workspace_id=m.workspace_id
  join healthdiet_core.dishes d on d.recipe_id=mr.recipe_id and d.workspace_id=mr.workspace_id
  join healthdiet_core.ingredients i on i.dish_id=d.id and i.workspace_id=d.workspace_id
  where m.workspace_id=wid and m.id=p_menu_id and m.active and lower(btrim(i.name))=lower(btrim(p_name)) and i.unit=p_unit
 ) then raise exception 'El ingrediente o el menú ya no están disponibles.'; end if;
 if p_checked then insert into healthdiet_core.shopping_checks values(wid,k) on conflict do nothing;
 else delete from healthdiet_core.shopping_checks where workspace_id=wid and ingredient_key=k; end if;
end $$;

create or replace function healthdiet_private.shopping_activate(p_menu_id uuid,p_confirm boolean)
returns void language plpgsql security definer set search_path='' as $$
declare wid uuid:=healthdiet_private.shopping_workspace(); current_id uuid;
begin
 select id into current_id from healthdiet_core.menus where workspace_id=wid and active;
 if current_id is distinct from p_menu_id then
  if not coalesce(p_confirm,false) and exists(select 1 from healthdiet_core.shopping_checks where workspace_id=wid)
  then raise exception 'SHOPPING_CONFIRM_REQUIRED'; end if;
  perform healthdiet_private.activate_menu(p_menu_id);
  delete from healthdiet_core.shopping_checks where workspace_id=wid;
 end if;
end $$;

create or replace function healthdiet_private.shopping_update_menu(p_menu_id uuid,p_name text,p_days jsonb,p_confirm boolean)
returns void language plpgsql security definer set search_path='' as $$
declare wid uuid:=healthdiet_private.shopping_workspace(); changed boolean; isactive boolean;
begin
 select active into isactive from healthdiet_core.menus where workspace_id=wid and id=p_menu_id;
 if not found then raise exception 'Menú no disponible.' using errcode='42501';end if;
 select (coalesce((select jsonb_agg(jsonb_build_array(e.weekday,e.meal,e.recipe_id::text) order by e.weekday,e.meal,e.recipe_id::text)
  from healthdiet_core.menu_recipes e where e.workspace_id=wid and e.menu_id=p_menu_id),'[]'::jsonb)
  is distinct from
  coalesce((select jsonb_agg(jsonb_build_array(d.ordinality,m.meal,r.value #>> '{}') order by d.ordinality,m.meal,r.value #>> '{}')
   from jsonb_array_elements(p_days) with ordinality d(day,ordinality)
   cross join lateral jsonb_array_elements(d.day) with ordinality meal(items,ordinality)
   cross join lateral (select (array['desayuno','almuerzo','comida','merienda','cena'])[meal.ordinality::int] as meal) m
   cross join lateral jsonb_array_elements(meal.items) r(value)),'[]'::jsonb)) into changed;
 if isactive and changed and not coalesce(p_confirm,false) and exists(select 1 from healthdiet_core.shopping_checks where workspace_id=wid)
 then raise exception 'SHOPPING_CONFIRM_REQUIRED';end if;
 perform healthdiet_private.update_menu(p_menu_id,p_name,p_days);
 if isactive and changed then delete from healthdiet_core.shopping_checks where workspace_id=wid; end if;
end $$;

create or replace function healthdiet_private.shopping_update_recipe(p_recipe_id uuid,p_name text,p_container text,p_steps jsonb,p_dishes jsonb,p_confirm boolean)
returns void language plpgsql security definer set search_path='' as $$
declare wid uuid:=healthdiet_private.shopping_workspace(); affected boolean;
begin
 select exists(select 1 from healthdiet_core.menus m join healthdiet_core.menu_recipes e on e.workspace_id=m.workspace_id and e.menu_id=m.id
 where m.workspace_id=wid and m.active and e.recipe_id=p_recipe_id) into affected;
 if affected and not coalesce(p_confirm,false) and exists(select 1 from healthdiet_core.shopping_checks where workspace_id=wid)
 then raise exception 'SHOPPING_CONFIRM_REQUIRED';end if;
 perform healthdiet_private.update_recipe(p_recipe_id,p_name,p_container,p_steps,p_dishes);
 if affected then delete from healthdiet_core.shopping_checks where workspace_id=wid; end if;
end $$;

create or replace function public.hd_shopping_read() returns jsonb language sql set search_path='' as $$ select healthdiet_private.shopping_read() $$;
create or replace function public.hd_shopping_set(p_menu_id uuid,p_name text,p_unit text,p_checked boolean) returns void language sql set search_path='' as $$ select healthdiet_private.shopping_set(p_menu_id,p_name,p_unit,p_checked) $$;
create or replace function public.hd_shopping_activate(p_menu_id uuid,p_confirm boolean) returns void language sql set search_path='' as $$ select healthdiet_private.shopping_activate(p_menu_id,p_confirm) $$;
create or replace function public.hd_shopping_update_menu(p_menu_id uuid,p_name text,p_days jsonb,p_confirm boolean) returns void language sql set search_path='' as $$ select healthdiet_private.shopping_update_menu(p_menu_id,p_name,p_days,p_confirm) $$;
create or replace function public.hd_shopping_update_recipe(p_recipe_id uuid,p_name text,p_container text,p_steps jsonb,p_dishes jsonb,p_confirm boolean) returns void language sql set search_path='' as $$ select healthdiet_private.shopping_update_recipe(p_recipe_id,p_name,p_container,p_steps,p_dishes,p_confirm) $$;
revoke all on function public.hd_shopping_read(),public.hd_shopping_set(uuid,text,text,boolean),public.hd_shopping_activate(uuid,boolean),public.hd_shopping_update_menu(uuid,text,jsonb,boolean),public.hd_shopping_update_recipe(uuid,text,text,jsonb,jsonb,boolean) from public,anon;
grant execute on function public.hd_shopping_read(),public.hd_shopping_set(uuid,text,text,boolean),public.hd_shopping_activate(uuid,boolean),public.hd_shopping_update_menu(uuid,text,jsonb,boolean),public.hd_shopping_update_recipe(uuid,text,text,jsonb,jsonb,boolean) to authenticated;
revoke all on function healthdiet_private.shopping_workspace(),healthdiet_private.shopping_read(),healthdiet_private.shopping_set(uuid,text,text,boolean),healthdiet_private.shopping_activate(uuid,boolean),healthdiet_private.shopping_update_menu(uuid,text,jsonb,boolean),healthdiet_private.shopping_update_recipe(uuid,text,text,jsonb,jsonb,boolean) from public,anon;
grant execute on function healthdiet_private.shopping_read(),healthdiet_private.shopping_set(uuid,text,text,boolean),healthdiet_private.shopping_activate(uuid,boolean),healthdiet_private.shopping_update_menu(uuid,text,jsonb,boolean),healthdiet_private.shopping_update_recipe(uuid,text,text,jsonb,jsonb,boolean) to authenticated;
