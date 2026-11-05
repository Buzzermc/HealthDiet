-- Recetas compartidas: cada operación obtiene el espacio de la cuenta verificada.
-- El navegador no recibe acceso directo a las tablas.
create function healthdiet_private.create_recipe(p_name text,p_container text,p_steps jsonb,p_dishes jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare uid uuid := healthdiet_private.verified_user(); wid uuid; rid uuid; did uuid; iid uuid;
  dish jsonb; ingredient jsonb; amount jsonb; mid uuid; n numeric;
  dish_pos integer:=0; ingredient_pos integer; seen uuid[];
begin
  select m.workspace_id into wid from healthdiet_core.members m where m.user_id=uid and m.left_at is null;
  if wid is null then raise exception 'Se necesita un espacio activo.' using errcode='42501'; end if;
  if length(btrim(coalesce(p_name,''))) not between 1 and 120
    or jsonb_typeof(p_steps) is distinct from 'array' or jsonb_array_length(p_steps)>100
    or jsonb_typeof(p_dishes) is distinct from 'array' or jsonb_array_length(p_dishes) not between 1 and 50
    or exists(select 1 from jsonb_array_elements(p_steps) x where jsonb_typeof(x)<>'string' or length(x #>> '{}')>2000)
    or length(coalesce(p_container,''))>60 then
    raise exception 'Datos de receta no válidos.';
  end if;
  -- Serializa los cambios del espacio con las salidas y traspasos de miembros.
  perform 1 from healthdiet_core.workspaces where id=wid for update;
  if not exists(select 1 from healthdiet_core.members where user_id=uid and workspace_id=wid and left_at is null) then
    raise exception 'Ya no perteneces al espacio.' using errcode='42501';
  end if;
  insert into healthdiet_core.recipes(workspace_id,name,container,steps)
    values(wid,btrim(p_name),nullif(btrim(p_container),''),p_steps) returning id into rid;
  for dish in select value from jsonb_array_elements(p_dishes) loop
    if jsonb_typeof(dish) <> 'object' or length(btrim(coalesce(dish->>'name',''))) not between 1 and 120
      or jsonb_typeof(dish->'ingredients') is distinct from 'array'
      or jsonb_array_length(dish->'ingredients') not between 1 and 100 then raise exception 'Plato no válido.'; end if;
    insert into healthdiet_core.dishes(workspace_id,recipe_id,name,position)
      values(wid,rid,btrim(dish->>'name'),dish_pos) returning id into did;
    dish_pos:=dish_pos+1; ingredient_pos:=0;
    for ingredient in select value from jsonb_array_elements(dish->'ingredients') loop
      if jsonb_typeof(ingredient) <> 'object' or length(btrim(coalesce(ingredient->>'name',''))) not between 1 and 120
        or coalesce(ingredient->>'unit','') not in ('g','unidad')
        or jsonb_typeof(ingredient->'quantities') is distinct from 'array'
        or jsonb_array_length(ingredient->'quantities') not between 1 and 100 then raise exception 'Ingrediente no válido.'; end if;
      insert into healthdiet_core.ingredients(workspace_id,dish_id,name,unit,position)
        values(wid,did,btrim(ingredient->>'name'),ingredient->>'unit',ingredient_pos) returning id into iid;
      ingredient_pos:=ingredient_pos+1; seen:=array[]::uuid[];
      for amount in select value from jsonb_array_elements(ingredient->'quantities') loop
        if jsonb_typeof(amount) <> 'object' or jsonb_typeof(amount->'quantity') is distinct from 'number' then
          raise exception 'Cantidad no válida.';
        end if;
        mid:=(amount->>'member_id')::uuid; n:=(amount->>'quantity')::numeric;
        if mid is null or mid=any(seen) or n<=0 or n>=1000000000 or not exists(
          select 1 from healthdiet_core.members where id=mid and workspace_id=wid and left_at is null) then
          raise exception 'Cantidad o persona no válida.';
        end if;
        seen:=array_append(seen,mid);
        insert into healthdiet_core.ingredient_quantities(workspace_id,ingredient_id,member_id,quantity)
          values(wid,iid,mid,n);
      end loop;
    end loop;
  end loop;
  return rid;
end $$;

create function healthdiet_private.list_recipes()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid:=healthdiet_private.verified_user(); wid uuid; output jsonb;
begin
  select workspace_id into wid from healthdiet_core.members where user_id=uid and left_at is null;
  if wid is null then raise exception 'Se necesita un espacio activo.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'container',r.container,'steps',r.steps,
    'dishes',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'ingredients',
      coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'unit',i.unit,
        'quantities',coalesce((select jsonb_agg(jsonb_build_object('member_id',q.member_id,'name',m.display_name,
          'active',m.left_at is null,'quantity',q.quantity) order by m.joined_at,m.id)
          from healthdiet_core.ingredient_quantities q join healthdiet_core.members m
          on m.workspace_id=q.workspace_id and m.id=q.member_id
          where q.workspace_id=wid and q.ingredient_id=i.id),'[]'::jsonb))
       order by i.position,i.id) from healthdiet_core.ingredients i where i.workspace_id=wid and i.dish_id=d.id),'[]'::jsonb))
     order by d.position,d.id) from healthdiet_core.dishes d where d.workspace_id=wid and d.recipe_id=r.id),'[]'::jsonb))
    order by r.created_at,r.id),'[]'::jsonb) into output from healthdiet_core.recipes r where r.workspace_id=wid;
  return output;
end $$;

create function public.hd_create_recipe(p_name text,p_container text,p_steps jsonb,p_dishes jsonb) returns uuid
language sql security invoker set search_path='' as $$select healthdiet_private.create_recipe(p_name,p_container,p_steps,p_dishes)$$;
create function public.hd_list_recipes() returns jsonb
language sql security invoker set search_path='' as $$select healthdiet_private.list_recipes()$$;
revoke all on function healthdiet_private.create_recipe(text,text,jsonb,jsonb),healthdiet_private.list_recipes() from public,anon,authenticated;
grant execute on function healthdiet_private.create_recipe(text,text,jsonb,jsonb),healthdiet_private.list_recipes() to authenticated;
revoke all on function public.hd_create_recipe(text,text,jsonb,jsonb),public.hd_list_recipes() from public,anon,authenticated;
grant execute on function public.hd_create_recipe(text,text,jsonb,jsonb),public.hd_list_recipes() to authenticated;
