-- Datos de prueba revertidos por la transacción interna.
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); wa uuid; wb uuid; ma uuid; mb uuid; rid uuid; doc jsonb; caught boolean;
begin
 begin
 insert into auth.users (id,aud,role,email,email_confirmed_at,created_at,updated_at) values
 (a,'authenticated','authenticated',a::text||'@test.invalid',now(),now(),now()),(b,'authenticated','authenticated',b::text||'@test.invalid',now(),now(),now());
 perform set_config('request.jwt.claim.sub',a::text,true);
 wa:=public.hd_create_workspace('A','Persona A');
 select id into ma from healthdiet_core.members where user_id=a and left_at is null;
 perform set_config('request.jwt.claim.sub',b::text,true);
 wb:=public.hd_create_workspace('B','Persona B');
 select id into mb from healthdiet_core.members where user_id=b and left_at is null;
 perform set_config('request.jwt.claim.sub',a::text,true);
 doc:=jsonb_build_array(jsonb_build_object('name','Arroz','ingredients',jsonb_build_array(jsonb_build_object('name','Arroz','unit','g','quantities',jsonb_build_array(jsonb_build_object('member_id',ma,'quantity',100))))));
 rid:=public.hd_create_recipe('Receta A','pequeño','[]'::jsonb,doc);
 if jsonb_array_length(public.hd_list_recipes())<>1 then raise exception 'Fallo lectura'; end if;
 doc:=jsonb_build_array(jsonb_build_object('name','Arroz','ingredients',jsonb_build_array(jsonb_build_object('name','Arroz','unit','g','quantities',jsonb_build_array(jsonb_build_object('member_id',mb,'quantity',50))))));
 caught:=false; begin perform public.hd_create_recipe('Inválida',null,'[]'::jsonb,doc); exception when others then caught:=true; end;
 if not caught then raise exception 'Aceptó cantidad de otro espacio'; end if;
 if jsonb_array_length(public.hd_list_recipes())<>1 then raise exception 'La operación inválida dejó datos'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 if jsonb_array_length(public.hd_list_recipes())<>0 then raise exception 'Los espacios no están aislados'; end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 update healthdiet_core.members set left_at=now() where id=ma;
 caught:=false; begin perform public.hd_list_recipes(); exception when insufficient_privilege then caught:=true; end;
 if not caught then raise exception 'Miembro inactivo accedió'; end if;
 raise exception 'ROLLBACK_PRUEBA';
 exception when raise_exception then if sqlerrm <> 'ROLLBACK_PRUEBA' then raise; end if; end;
end $$;
select 'Pruebas de recetas superadas; datos revertidos' as resultado;