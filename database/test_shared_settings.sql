-- Los datos temporales se revierten.
do $$ declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();w uuid; id uuid; caught boolean; begin begin
insert into auth.users (id,aud,role,email,email_confirmed_at,created_at,updated_at) values (a,'authenticated','authenticated',a::text||'@test.invalid',now(),now(),now()),(b,'authenticated','authenticated',b::text||'@test.invalid',now(),now(),now());
perform set_config('request.jwt.claim.sub',a::text,true);w:=public.hd_create_workspace('Uno','Uno');id:=public.hd_add_container('cristal');perform public.hd_set_my_color('#112233');
if jsonb_array_length(public.hd_settings_read())<>3 then raise exception 'Número de táperes incorrecto';end if;
if (select color from healthdiet_core.members where user_id=a) <> '#112233' then raise exception 'Color incorrecto';end if;
caught:=false;begin perform public.hd_add_container('CRISTAL');exception when others then caught:=true;end;if not caught then raise exception 'Duplicado permitido';end if;
perform set_config('request.jwt.claim.sub',b::text,true);w:=public.hd_create_workspace('Dos','Dos');
if jsonb_array_length(public.hd_settings_read())<>2 then raise exception 'Fuga entre espacios';end if;
caught:=false;begin perform public.hd_set_my_color('red');exception when others then caught:=true;end;if not caught then raise exception 'Color inválido permitido';end if;
raise exception 'ROLLBACK_TEST'; exception when raise_exception then if sqlerrm<>'ROLLBACK_TEST' then raise;end if;end;end $$;
select 'Pruebas de configuración superadas; datos revertidos' as resultado;