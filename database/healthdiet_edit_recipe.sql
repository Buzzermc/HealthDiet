-- Edición de recetas atómica con conservación de cantidades históricas.
create function healthdiet_private.update_recipe(p_recipe_id uuid,p_name text,p_container text,p_steps jsonb,p_dishes jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=healthdiet_private.verified_user(); wid uuid; dish jsonb; ingredient jsonb; amount jsonb;
 did uuid; iid uuid; mid uuid; n numeric; dishpos int:=0; ingpos int;
 dish_ids uuid[]:=array[]::uuid[]; ingredient_ids uuid[]:=array[]::uuid[]; person_ids uuid[];
begin
 select workspace_id into wid from healthdiet_core.members where user_id=uid and left_at is null;
 if wid is null then raise exception 'Se necesita un espacio activo.' using errcode='42501'; end if;
 if length(btrim(coalesce(p_name,''))) not between 1 and 120 or length(coalesce(p_container,''))>60
  or jsonb_typeof(p_steps) is distinct from 'array' or jsonb_array_length(p_steps)>100
  or exists(select 1 from jsonb_array_elements(p_steps) x where jsonb_typeof(x)<>'string' or length(x #>> '{}')>2000)
  or jsonb_typeof(p_dishes) is distinct from 'array' or jsonb_array_length(p_dishes) not between 1 and 50
 then raise exception 'Datos de receta no válidos.'; end if;
 perform 1 from healthdiet_core.workspaces where id=wid for update;
 if not exists(select 1 from healthdiet_core.members where workspace_id=wid and user_id=uid and left_at is null)
 then raise exception 'Ya no perteneces al espacio.' using errcode='42501'; end if;
 if not exists(select 1 from healthdiet_core.recipes where workspace_id=wid and id=p_recipe_id)
 then raise exception 'Receta no disponible.' using errcode='42501'; end if;
 update healthdiet_core.recipes set name=btrim(p_name),container=nullif(btrim(p_container),''),steps=p_steps where workspace_id=wid and id=p_recipe_id;
 for dish in select value from jsonb_array_elements(p_dishes) loop
  if jsonb_typeof(dish) is distinct from 'object' or length(btrim(coalesce(dish->>'name',''))) not between 1 and 120
    or jsonb_typeof(dish->'ingredients') is distinct from 'array' or jsonb_array_length(dish->'ingredients') not between 1 and 100
  then raise exception 'Plato no válido.'; end if;
  did:=nullif(dish->>'id','')::uuid;
  if did is null then
   insert into healthdiet_core.dishes(workspace_id,recipe_id,name,position) values(wid,p_recipe_id,btrim(dish->>'name'),dishpos) returning id into did;
  else
   if did=any(dish_ids) then raise exception 'Plato duplicado.'; end if;
   update healthdiet_core.dishes set name=btrim(dish->>'name'),position=dishpos where id=did and workspace_id=wid and recipe_id=p_recipe_id;
   if not found then raise exception 'Plato no disponible.' using errcode='42501'; end if;
  end if;
  dish_ids:=array_append(dish_ids,did);dishpos:=dishpos+1;ingpos:=0;
  for ingredient in select value from jsonb_array_elements(dish->'ingredients') loop
   if jsonb_typeof(ingredient) is distinct from 'object' or length(btrim(coalesce(ingredient->>'name',''))) not between 1 and 120
    or coalesce(ingredient->>'unit','') not in ('g','unidad') or jsonb_typeof(ingredient->'quantities') is distinct from 'array'
    or jsonb_array_length(ingredient->'quantities') not between 1 and 100 then raise exception 'Ingrediente no válido.'; end if;
   iid:=nullif(ingredient->>'id','')::uuid;
   if iid is null then
    insert into healthdiet_core.ingredients(workspace_id,dish_id,name,unit,position) values(wid,did,btrim(ingredient->>'name'),ingredient->>'unit',ingpos) returning id into iid;
   else
    if iid=any(ingredient_ids) then raise exception 'Ingrediente duplicado.'; end if;
    if exists(select 1 from healthdiet_core.ingredient_quantities q join healthdiet_core.members m on m.id=q.member_id and m.workspace_id=q.workspace_id
     join healthdiet_core.ingredients i on i.id=q.ingredient_id and i.workspace_id=q.workspace_id
     where q.workspace_id=wid and q.ingredient_id=iid and m.left_at is not null and (i.name<>btrim(ingredient->>'name') or i.unit<>ingredient->>'unit'))
    then raise exception 'No se puede cambiar un ingrediente con cantidades históricas.'; end if;
    update healthdiet_core.ingredients set name=btrim(ingredient->>'name'),unit=ingredient->>'unit',position=ingpos where id=iid and workspace_id=wid and dish_id=did;
    if not found then raise exception 'Ingrediente no disponible.' using errcode='42501'; end if;
   end if;
   ingredient_ids:=array_append(ingredient_ids,iid);ingpos:=ingpos+1;person_ids:=array[]::uuid[];
   for amount in select value from jsonb_array_elements(ingredient->'quantities') loop
    if jsonb_typeof(amount) is distinct from 'object' or jsonb_typeof(amount->'quantity') is distinct from 'number' then raise exception 'Cantidad no válida.';end if;
    mid:=(amount->>'member_id')::uuid;n:=(amount->>'quantity')::numeric;
    if mid is null or mid=any(person_ids) or n<=0 or n>=1000000000 or not exists(select 1 from healthdiet_core.members where id=mid and workspace_id=wid and left_at is null)
    then raise exception 'Cantidad o persona no válida.';end if;
    person_ids:=array_append(person_ids,mid);
    insert into healthdiet_core.ingredient_quantities(workspace_id,ingredient_id,member_id,quantity) values(wid,iid,mid,n)
    on conflict (ingredient_id,member_id) do update set quantity=excluded.quantity;
   end loop;
   delete from healthdiet_core.ingredient_quantities q using healthdiet_core.members m
    where q.workspace_id=wid and q.ingredient_id=iid and m.workspace_id=q.workspace_id and m.id=q.member_id
    and m.left_at is null and not(q.member_id=any(person_ids));
  end loop;
 end loop;
 if exists(select 1 from healthdiet_core.ingredient_quantities q join healthdiet_core.members m on m.id=q.member_id and m.workspace_id=q.workspace_id
  join healthdiet_core.ingredients i on i.id=q.ingredient_id and i.workspace_id=q.workspace_id
  join healthdiet_core.dishes d on d.id=i.dish_id and d.workspace_id=i.workspace_id
  where d.workspace_id=wid and d.recipe_id=p_recipe_id and m.left_at is not null and not(i.id=any(ingredient_ids)))
 then raise exception 'No se pueden eliminar ingredientes con cantidades históricas.';end if;
 delete from healthdiet_core.ingredients i using healthdiet_core.dishes d
  where i.workspace_id=wid and d.workspace_id=wid and i.dish_id=d.id and d.recipe_id=p_recipe_id and not(i.id=any(ingredient_ids));
 delete from healthdiet_core.dishes where workspace_id=wid and recipe_id=p_recipe_id and not(id=any(dish_ids));
end $$;
create function public.hd_update_recipe(p_recipe_id uuid,p_name text,p_container text,p_steps jsonb,p_dishes jsonb) returns void
language sql security invoker set search_path='' as $$select healthdiet_private.update_recipe(p_recipe_id,p_name,p_container,p_steps,p_dishes)$$;
revoke all on function healthdiet_private.update_recipe(uuid,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function healthdiet_private.update_recipe(uuid,text,text,jsonb,jsonb) to authenticated;
revoke all on function public.hd_update_recipe(uuid,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.hd_update_recipe(uuid,text,text,jsonb,jsonb) to authenticated;