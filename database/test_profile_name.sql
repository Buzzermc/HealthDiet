do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();w uuid;member_a uuid;member_b uuid;recipe_id uuid;data jsonb;rejected boolean;
begin begin
 insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at)
 values(a,'authenticated','authenticated',a::text||'@test.invalid',now(),now(),now()),
 (b,'authenticated','authenticated',b::text||'@test.invalid',now(),now(),now());
 perform set_config('request.jwt.claim.sub',a::text,true);
 w:=public.hd_create_workspace('Prueba nombres','Anterior');
 select id into member_a from healthdiet_core.members where user_id=a and left_at is null;
 insert into healthdiet_core.members(workspace_id,user_id,display_name,role) values(w,b,'Otra persona','member') returning id into member_b;
 recipe_id:=public.hd_create_recipe('Prueba',null,'[]'::jsonb,jsonb_build_array(jsonb_build_object('name','Plato','ingredients',
  jsonb_build_array(jsonb_build_object('name','Tomate','unit','g','quantities',jsonb_build_array(jsonb_build_object('member_id',member_a,'quantity',100)))))));
 perform public.hd_set_my_name('  Alba  ');
 if (select display_name from healthdiet_core.members where id=member_a)<>'Alba' then raise exception 'No se guardó el nombre';end if;
 if (select display_name from healthdiet_core.members where id=member_b)<>'Otra persona' then raise exception 'Se cambió otra persona';end if;
 data:=public.hd_list_recipes();
 if data->0->'dishes'->0->'ingredients'->0->'quantities'->0->>'name'<>'Alba' then raise exception 'La receta no muestra el nombre nuevo';end if;
 rejected:=false;begin perform public.hd_set_my_name('   ');exception when others then rejected:=true;end;
 if not rejected or (select display_name from healthdiet_core.members where id=member_a)<>'Alba' then raise exception 'Se aceptó un nombre vacío';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);perform public.hd_set_my_name('Pablo');
 if (select display_name from healthdiet_core.members where id=member_a)<>'Alba' then raise exception 'Un usuario modificó a otro';end if;
 raise exception 'REVERTIR_PRUEBA';
 exception when raise_exception then if sqlerrm<>'REVERTIR_PRUEBA' then raise;end if;end;
end $$;
select 'Nombre actualizado, propagación y aislamiento comprobados; datos revertidos' resultado;
