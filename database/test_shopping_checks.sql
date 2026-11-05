do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();w uuid;mb uuid;r uuid;menu_a uuid;menu_b uuid;dia jsonb;semana jsonb;semana2 jsonb; caught boolean;
begin begin
 insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
 (a,'authenticated','authenticated',a::text||'@test.invalid',now(),now(),now()),(b,'authenticated','authenticated',b::text||'@test.invalid',now(),now(),now());
 perform set_config('request.jwt.claim.sub',a::text,true);w:=public.hd_create_workspace('Prueba compras','Persona A');select id into mb from healthdiet_core.members where user_id=a and left_at is null;
 r:=public.hd_create_recipe('Arroz',null,'[]'::jsonb,jsonb_build_array(jsonb_build_object('name','Arroz','ingredients',jsonb_build_array(jsonb_build_object('name','Tomate','unit','g','quantities',jsonb_build_array(jsonb_build_object('member_id',mb,'quantity',100)))))));
 dia:=jsonb_build_array('[]'::jsonb,'[]'::jsonb,jsonb_build_array(r),'[]'::jsonb,jsonb_build_array(r));semana:=jsonb_build_array(dia,dia,dia,dia,dia,dia,dia);
 menu_a:=public.hd_save_menu('Original',semana);menu_b:=public.hd_save_menu('Otro',semana);
 perform public.hd_shopping_activate(menu_a,false);
 perform public.hd_shopping_set(menu_a,'Tomate','g',true);
 if not (public.hd_shopping_read()->'checked' ? 'tomate|g') then raise exception 'Marca no guardada'; end if;
 perform public.hd_shopping_update_menu(menu_a,'Renombrado',semana,false);
 if not (public.hd_shopping_read()->'checked' ? 'tomate|g') then raise exception 'Renombrar borró las marcas'; end if;
 caught:=false;begin perform public.hd_shopping_activate(menu_b,false);exception when others then if sqlerrm='SHOPPING_CONFIRM_REQUIRED' then caught:=true;else raise;end if;end;
 if not caught or not(public.hd_shopping_read()->'checked' ? 'tomate|g') then raise exception 'Aviso no protege marcas';end if;
 perform public.hd_shopping_activate(menu_b,true);
 if jsonb_array_length(public.hd_shopping_read()->'checked')<>0 then raise exception 'Cambio no reinició marcas';end if;
 perform public.hd_shopping_set(menu_b,'Tomate','g',true);
 semana2:=jsonb_build_array(jsonb_build_array(jsonb_build_array(r),'[]'::jsonb,jsonb_build_array(r),'[]'::jsonb,jsonb_build_array(r)),dia,dia,dia,dia,dia,dia);
 caught:=false;begin perform public.hd_shopping_update_menu(menu_b,'Otro',semana2,false);exception when others then if sqlerrm='SHOPPING_CONFIRM_REQUIRED' then caught:=true;else raise;end if;end;
 if not caught then raise exception 'No se avisó al editar menú';end if;
 perform public.hd_shopping_update_menu(menu_b,'Otro',semana2,true);
 if jsonb_array_length(public.hd_shopping_read()->'checked')<>0 then raise exception 'Edición no reinició marcas';end if;
 perform public.hd_shopping_set(menu_b,'Tomate','g',true);
 perform set_config('request.jwt.claim.sub',b::text,true);perform public.hd_create_workspace('Otro espacio','Persona B');
 if jsonb_array_length(public.hd_shopping_read()->'checked')<>0 then raise exception 'Filtración entre espacios';end if;
 caught:=false;begin perform public.hd_shopping_set(menu_b,'Tomate','g',true);exception when others then caught:=true;end;
 if not caught then raise exception 'Acceso ajeno permitido';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);perform public.hd_delete_menu(menu_b);
 if jsonb_array_length(public.hd_shopping_read()->'checked')<>0 then raise exception 'Eliminar menú activo no limpió marcas';end if;
 raise exception 'REVERTIR_PRUEBA';
 exception when raise_exception then if sqlerrm<>'REVERTIR_PRUEBA' then raise;end if;end;
end $$; select 'Prueba superada; datos temporales revertidos' resultado;
