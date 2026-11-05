-- Menús compartidos; todas las operaciones comprueban pertenencia activa.
create function healthdiet_private.save_menu(p_name text, p_days jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$
declare uid uuid:=healthdiet_private.verified_user(); wid uuid; menu_id uuid;
day_data jsonb; meal_data jsonb; recipe jsonb; recipe_id uuid; di integer:=0; mi integer; pos integer;
meals text[]:=array['desayuno','almuerzo','comida','merienda','cena'];
begin
 select workspace_id into wid from healthdiet_core.members where user_id=uid and left_at is null;
 if wid is null then raise exception 'Se necesita un espacio activo.' using errcode='42501'; end if;
 if length(btrim(coalesce(p_name,''))) not between 1 and 120 or jsonb_typeof(p_days) is distinct from 'array' or jsonb_array_length(p_days)<>7 then raise exception 'Menú no válido.'; end if;
 perform 1 from healthdiet_core.workspaces where id=wid for update;
 if not exists(select 1 from healthdiet_core.members where user_id=uid and workspace_id=wid and left_at is null) then raise exception 'Ya no perteneces al espacio.' using errcode='42501'; end if;
 insert into healthdiet_core.menus(workspace_id,name) values(wid,btrim(p_name)) returning id into menu_id;
 for day_data in select value from jsonb_array_elements(p_days) loop
  di:=di+1; mi:=0;
  if jsonb_typeof(day_data) is distinct from 'array' or jsonb_array_length(day_data)<>5 then raise exception 'Día no válido.'; end if;
  for meal_data in select value from jsonb_array_elements(day_data) loop
   mi:=mi+1;pos:=0;
   if jsonb_typeof(meal_data) is distinct from 'array' or jsonb_array_length(meal_data)>50 then raise exception 'Comida no válida.'; end if;
   if mi in (3,5) and jsonb_array_length(meal_data)=0 then raise exception 'La comida y la cena son obligatorias.'; end if;
   for recipe in select value from jsonb_array_elements(meal_data) loop
    if jsonb_typeof(recipe) is distinct from 'string' then raise exception 'Receta no válida.'; end if;
    recipe_id:=(recipe #>> '{}')::uuid;
    if not exists(select 1 from healthdiet_core.recipes where id=recipe_id and workspace_id=wid) then raise exception 'Receta no disponible.' using errcode='42501'; end if;
    insert into healthdiet_core.menu_recipes(workspace_id,menu_id,recipe_id,weekday,meal,position) values(wid,menu_id,recipe_id,di,meals[mi],pos); pos:=pos+1;
   end loop;
  end loop;
 end loop;
 return menu_id;
end $$;

create function healthdiet_private.list_menus()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=healthdiet_private.verified_user(); wid uuid; output jsonb;
begin
 select workspace_id into wid from healthdiet_core.members where user_id=uid and left_at is null;
 if wid is null then raise exception 'Se necesita un espacio activo.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'active',m.active,'entries',
 coalesce((select jsonb_agg(jsonb_build_object('day',e.weekday,'meal',e.meal,'recipe_id',e.recipe_id,'position',e.position) order by e.weekday,e.meal,e.position)
 from healthdiet_core.menu_recipes e where e.workspace_id=wid and e.menu_id=m.id),'[]'::jsonb)) order by m.created_at,m.id),'[]'::jsonb)
 into output from healthdiet_core.menus m where m.workspace_id=wid;
 return output;
end $$;

create function healthdiet_private.activate_menu(p_menu_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare uid uuid:=healthdiet_private.verified_user(); wid uuid;
begin
 select workspace_id into wid from healthdiet_core.members where user_id=uid and left_at is null;
 if wid is null then raise exception 'Se necesita un espacio activo.' using errcode='42501'; end if;
 perform 1 from healthdiet_core.workspaces where id=wid for update;
 if not exists(select 1 from healthdiet_core.members where user_id=uid and workspace_id=wid and left_at is null) then raise exception 'Ya no perteneces al espacio.' using errcode='42501'; end if;
 if not exists(select 1 from healthdiet_core.menus where id=p_menu_id and workspace_id=wid) then raise exception 'Menú no disponible.' using errcode='42501'; end if;
 if exists (select 1 from generate_series(1,7) as day cross join (values ('comida'),('cena')) as meal(name)
 where not exists (select 1 from healthdiet_core.menu_recipes where workspace_id=wid and menu_id=p_menu_id and weekday=day and healthdiet_core.menu_recipes.meal=meal.name)) then raise exception 'Menú incompleto.'; end if;
 update healthdiet_core.menus set active=false where workspace_id=wid and active;
 update healthdiet_core.menus set active=true where workspace_id=wid and id=p_menu_id;
end $$;

create function public.hd_save_menu(p_name text,p_days jsonb) returns uuid language sql security invoker set search_path='' as $$ select healthdiet_private.save_menu(p_name,p_days) $$;
create function public.hd_list_menus() returns jsonb language sql security invoker set search_path='' as $$ select healthdiet_private.list_menus() $$;
create function public.hd_activate_menu(p_menu_id uuid) returns void language sql security invoker set search_path='' as $$ select healthdiet_private.activate_menu(p_menu_id) $$;
revoke all on function healthdiet_private.save_menu(text,jsonb),healthdiet_private.list_menus(),healthdiet_private.activate_menu(uuid) from public,anon,authenticated;
grant execute on function healthdiet_private.save_menu(text,jsonb),healthdiet_private.list_menus(),healthdiet_private.activate_menu(uuid) to authenticated;
revoke all on function public.hd_save_menu(text,jsonb),public.hd_list_menus(),public.hd_activate_menu(uuid) from public,anon,authenticated;
grant execute on function public.hd_save_menu(text,jsonb),public.hd_list_menus(),public.hd_activate_menu(uuid) to authenticated;