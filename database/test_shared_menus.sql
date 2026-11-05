-- Datos temporales revertidos por la prueba.
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); wa uuid; wb uuid; ma uuid; rb uuid; ra uuid; m1 uuid; m2 uuid; day jsonb; week jsonb; caught boolean;
begin begin
 insert into auth.users (id,aud,role,email,email_confirmed_at,created_at,updated_at) values
 (a,'authenticated','authenticated',a::text||'@test.invalid',now(),now(),now()),
 (b,'authenticated','authenticated',b::text||'@test.invalid',now(),now(),now());
 perform set_config('request.jwt.claim.sub',a::text,true); wa:=public.hd_create_workspace('A','A');
 select id into ma from healthdiet_core.members where user_id=a and left_at is null;
 ra:=public.hd_create_recipe('Arroz',null,'[]'::jsonb,jsonb_build_array(jsonb_build_object('name','Arroz','ingredients',jsonb_build_array(jsonb_build_object('name','Arroz','unit','g','quantities',jsonb_build_array(jsonb_build_object('member_id',ma,'quantity',100)))))));
 perform set_config('request.jwt.claim.sub',b::text,true); wb:=public.hd_create_workspace('B','B');
 select id into ma from healthdiet_core.members where user_id=b and left_at is null;
 rb:=public.hd_create_recipe('Otra',null,'[]'::jsonb,jsonb_build_array(jsonb_build_object('name','Otra','ingredients',jsonb_build_array(jsonb_build_object('name','Otro','unit','g','quantities',jsonb_build_array(jsonb_build_object('member_id',ma,'quantity',1)))))));
 perform set_config('request.jwt.claim.sub',a::text,true);
 day:=jsonb_build_array('[]'::jsonb,'[]'::jsonb,jsonb_build_array(ra),'[]'::jsonb,jsonb_build_array(ra));
 week:=jsonb_build_array(day,day,day,day,day,day,day);
 m1:=public.hd_save_menu('Semana',week);
 m2:=public.hd_save_menu('Semana 2',week);
 perform public.hd_activate_menu(m1);perform public.hd_activate_menu(m2);
 if (select count(*) from healthdiet_core.menus where workspace_id=wa and active)<>1 then raise exception 'Más de un menú activo'; end if;
 caught:=false;begin perform public.hd_save_menu('Incompleto',jsonb_build_array('[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb));exception when others then caught:=true;end;
 if not caught then raise exception 'Se guardó menú incompleto'; end if;
 day:=jsonb_build_array('[]'::jsonb,'[]'::jsonb,jsonb_build_array(rb),'[]'::jsonb,jsonb_build_array(ra));
 week:=jsonb_build_array(day,day,day,day,day,day,day);
 caught:=false;begin perform public.hd_save_menu('Ajeno',week);exception when insufficient_privilege then caught:=true;end;
 if not caught then raise exception 'Aceptó receta de otro espacio'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 if jsonb_array_length(public.hd_list_menus())<>0 then raise exception 'Acceso indebido'; end if;
 caught:=false;begin perform public.hd_activate_menu(m1);exception when insufficient_privilege then caught:=true;end;
 if not caught then raise exception 'Activó menú ajeno'; end if;
 raise exception 'ROLLBACK_PRUEBA';
 exception when raise_exception then if sqlerrm<>'ROLLBACK_PRUEBA' then raise; end if; end;
end $$;
select 'Pruebas de menús superadas; datos revertidos' as resultado;