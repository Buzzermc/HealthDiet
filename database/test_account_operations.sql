-- Ejecutar solo como administrador en un entorno de pruebas; los datos se revierten.
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); w uuid; inv uuid; mid uuid; caught boolean;
begin
begin
insert into auth.users (id,aud,role,email,email_confirmed_at,created_at,updated_at) values
(a,'authenticated','authenticated',a::text||'@test.invalid',now(),now(),now()),
(b,'authenticated','authenticated',b::text||'@test.invalid',now(),now(),now()),
(c,'authenticated','authenticated',c::text||'@test.invalid',now(),now(),now());
perform set_config('request.jwt.claim.sub',a::text,true);
w:=public.hd_create_workspace('Espacio prueba','Administradora');
caught:=false; begin perform public.hd_create_workspace('Otro','Admin'); exception when unique_violation then caught:=true; end;
if not caught then raise exception 'Límite de espacio falló'; end if;
caught:=false; begin perform public.hd_leave_workspace(); exception when others then caught:=true; end;
if not caught then raise exception 'Administrador pudo salir'; end if;
inv:=public.hd_invite(b::text||'@test.invalid');
perform set_config('request.jwt.claim.sub',c::text,true);
caught:=false; begin perform public.hd_accept_invitation(inv,'Intruso'); exception when insufficient_privilege then caught:=true; end;
if not caught then raise exception 'Correo equivocado aceptado'; end if;
perform set_config('request.jwt.claim.sub',b::text,true);
if public.hd_accept_invitation(inv,'Miembro')<>w then raise exception 'Espacio incorrecto'; end if;
caught:=false; begin perform public.hd_invite(c::text||'@test.invalid'); exception when insufficient_privilege then caught:=true; end;
if not caught then raise exception 'Miembro invitó'; end if;
select id into mid from healthdiet_core.members where user_id=b and left_at is null;
perform set_config('request.jwt.claim.sub',a::text,true);
perform public.hd_transfer_admin(mid); perform public.hd_leave_workspace();
if (select count(*) from healthdiet_core.members where workspace_id=w and left_at is null and role='admin')<>1 then raise exception 'Administración incorrecta'; end if;
raise exception 'REVERTIR_PRUEBA';
exception when raise_exception then if sqlerrm <> 'REVERTIR_PRUEBA' then raise; end if;
end;
end $$;
select 'Pruebas superadas; datos de prueba revertidos' as result;