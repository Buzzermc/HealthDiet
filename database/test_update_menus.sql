-- Los datos temporales se revierten.
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();w uuid;wa uuid;mb uuid;r uuid;v_menu_id uuid;copy_id uuid;dia jsonb;semana jsonb;caught boolean;
begin begin
 insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
 (a,'authenticated','authenticated',a::text||'@test.invalid',now(),now(),now()),(b,'authenticated','authenticated',b::text||'@test.invalid',now(),now(),now());
 perform set_config('request.jwt.claim.sub',a::text,true);w:=public.hd_create_workspace('Espacio A','Persona A');select id into mb from healthdiet_core.members where user_id=a and left_at is null;
 r:=public.hd_create_recipe('Arroz',null,'[]'::jsonb,jsonb_build_array(jsonb_build_object('name','Arroz','ingredients',jsonb_build_array(jsonb_build_object('name','Tomate','unit','g','quantities',jsonb_build_array(jsonb_build_object('member_id',mb,'quantity',100)))))));
 dia:=jsonb_build_array('[]'::jsonb,'[]'::jsonb,jsonb_build_array(r),'[]'::jsonb,jsonb_build_array(r));semana:=jsonb_build_array(dia,dia,dia,dia,dia,dia,dia);
 v_menu_id:=public.hd_save_menu('Original',semana);perform public.hd_activate_menu(v_menu_id);
 perform public.hd_update_menu(v_menu_id,'Actualizado',semana);
 if not exists(select 1 from healthdiet_core.menus where id=v_menu_id and workspace_id=w and name='Actualizado' and active)
 or (select count(*) from healthdiet_core.menu_recipes where healthdiet_core.menu_recipes.menu_id=v_menu_id)<>14 then raise exception 'Edición incorrecta';end if;
 caught:=false;begin perform public.hd_update_menu(v_menu_id,'Incompleto','[]'::jsonb);exception when others then caught:=true;end;
 if not caught or not exists(select 1 from healthdiet_core.menus where id=v_menu_id and name='Actualizado' and active) then raise exception 'No se revirtió edición inválida';end if;
 copy_id:=public.hd_save_menu('Copia',semana);
 if (select active from healthdiet_core.menus where id=copy_id) then raise exception 'Copia se activó sola';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);wa:=public.hd_create_workspace('Espacio B','Persona B');caught:=false;
 begin perform public.hd_delete_menu(v_menu_id);exception when insufficient_privilege then caught:=true;end;
 if not caught then raise exception 'Usuario ajeno eliminó el menú';end if;
 caught:=false;begin perform public.hd_update_menu(v_menu_id,'Ajeno',semana);exception when insufficient_privilege then caught:=true;end;
 if not caught then raise exception 'Usuario ajeno editó el menú';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);perform public.hd_delete_menu(copy_id);
 if exists(select 1 from healthdiet_core.menus where id=copy_id) or not exists(select 1 from healthdiet_core.menus where id=v_menu_id and active) then raise exception 'Eliminación incorrecta';end if;
 raise exception 'REVERTIR_PRUEBA';
 exception when raise_exception then if sqlerrm<>'REVERTIR_PRUEBA' then raise;end if;end;
end $$; select 'Edición, copia, eliminación y aislamiento verificados; datos revertidos' as resultado;