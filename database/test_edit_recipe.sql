-- Los datos temporales se revierten.
do $$ declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();w uuid;wb uuid;ma uuid;mb uuid;r uuid; d uuid;i uuid; edited jsonb; caught boolean;
begin begin
insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
(a,'authenticated','authenticated',a::text||'@test.invalid',now(),now(),now()),(b,'authenticated','authenticated',b::text||'@test.invalid',now(),now(),now()),(c,'authenticated','authenticated',c::text||'@test.invalid',now(),now(),now());
perform set_config('request.jwt.claim.sub',a::text,true);w:=public.hd_create_workspace('A','A');select id into ma from healthdiet_core.members where user_id=a and left_at is null;
insert into healthdiet_core.members(workspace_id,user_id,display_name,role) values(w,b,'B','member') returning id into mb;
r:=public.hd_create_recipe('Original',null,'[]'::jsonb,jsonb_build_array(jsonb_build_object('name','Plato','ingredients',jsonb_build_array(jsonb_build_object('name','Arroz','unit','g','quantities',jsonb_build_array(jsonb_build_object('member_id',ma,'quantity',100),jsonb_build_object('member_id',mb,'quantity',80)))))));
select id into d from healthdiet_core.dishes where recipe_id=r;select id into i from healthdiet_core.ingredients where dish_id=d;
update healthdiet_core.members set left_at=now() where id=mb;
edited:=jsonb_build_array(jsonb_build_object('id',d,'name','Plato','ingredients',jsonb_build_array(jsonb_build_object('id',i,'name','Arroz','unit','g','quantities',jsonb_build_array(jsonb_build_object('member_id',ma,'quantity',120))))));
perform public.hd_update_recipe(r,'Nuevo','grande',jsonb_build_array('Cocer'),edited);
if (select name from healthdiet_core.recipes where id=r)<>'Nuevo' or (select quantity from healthdiet_core.ingredient_quantities where ingredient_id=i and member_id=mb)<>80 or (select quantity from healthdiet_core.ingredient_quantities where ingredient_id=i and member_id=ma)<>120 then raise exception 'No se conservaron las cantidades';end if;
caught:=false;begin perform public.hd_update_recipe(r,'Incorrecta',null,'[]'::jsonb,jsonb_build_array(jsonb_build_object('name','Otro','ingredients',jsonb_build_array(jsonb_build_object('name','Otro','unit','g','quantities',jsonb_build_array(jsonb_build_object('member_id',ma,'quantity',1)))))));exception when others then caught:=true;end;
if not caught or (select name from healthdiet_core.recipes where id=r)<>'Nuevo' then raise exception 'Se ha alterado la cantidad histórica';end if;
perform set_config('request.jwt.claim.sub',c::text,true);wb:=public.hd_create_workspace('C','C');caught:=false;
begin perform public.hd_update_recipe(r,'Intruso',null,'[]'::jsonb,edited);exception when insufficient_privilege then caught:=true;end;
if not caught then raise exception 'Usuario ajeno editó la receta';end if;
raise exception 'REVERTIR_PRUEBA';
exception when raise_exception then if sqlerrm<>'REVERTIR_PRUEBA' then raise;end if;end;end $$;
select 'Pruebas de edición superadas; datos revertidos' as resultado;