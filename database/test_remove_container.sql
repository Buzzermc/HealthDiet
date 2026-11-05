-- Los datos temporales se revierten.
do $$ declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();wa uuid;wb uuid;ma uuid;ca uuid;r uuid;caught boolean;
begin begin
insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values (a,'authenticated','authenticated',a::text||'@test.invalid',now(),now(),now()),(b,'authenticated','authenticated',b::text||'@test.invalid',now(),now(),now());
perform set_config('request.jwt.claim.sub',a::text,true);wa:=public.hd_create_workspace('A','A');select id into ma from healthdiet_core.members where user_id=a and left_at is null;ca:=public.hd_add_container('cristal');
r:=public.hd_create_recipe('Prueba','cristal','[]'::jsonb,jsonb_build_array(jsonb_build_object('name','Plato','ingredients',jsonb_build_array(jsonb_build_object('name','Arroz','unit','g','quantities',jsonb_build_array(jsonb_build_object('member_id',ma,'quantity',1)))))));
perform set_config('request.jwt.claim.sub',b::text,true);wb:=public.hd_create_workspace('B','B');caught:=false;
begin perform public.hd_remove_container(ca);exception when insufficient_privilege then caught:=true;end;
if not caught then raise exception 'Otra cuenta eliminó el táper';end if;
perform set_config('request.jwt.claim.sub',a::text,true);perform public.hd_remove_container(ca);
if (select container from healthdiet_core.recipes where id=r)<>'cristal' then raise exception 'Receta perdió su táper';end if;
raise exception 'REVERTIR_PRUEBA'; exception when raise_exception then if sqlerrm<>'REVERTIR_PRUEBA' then raise;end if;end;end $$; select 'Pruebas de eliminación superadas; datos revertidos' as resultado;