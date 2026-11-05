-- Configuración compartida y color personal; las tablas siguen sin exponerse.
create function healthdiet_private.settings_read() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=healthdiet_private.verified_user(); wid uuid; output jsonb;
begin
 select workspace_id into wid from healthdiet_core.members where user_id=uid and left_at is null;
 if wid is null then raise exception 'Se necesita un espacio activo.' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by lower(c.name),c.id),'[]'::jsonb)
 into output from healthdiet_core.containers c where c.workspace_id=wid;
 return output;
end $$;
create function healthdiet_private.settings_add_container(p_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=healthdiet_private.verified_user();wid uuid;result uuid;
begin
 select workspace_id into wid from healthdiet_core.members where user_id=uid and left_at is null;
 if wid is null then raise exception 'Se necesita un espacio activo.' using errcode='42501'; end if;
 if length(btrim(coalesce(p_name,''))) not between 1 and 60 then raise exception 'Nombre no válido.'; end if;
 perform 1 from healthdiet_core.workspaces where id=wid for update;
 if not exists(select 1 from healthdiet_core.members where user_id=uid and workspace_id=wid and left_at is null) then raise exception 'Ya no perteneces al espacio.' using errcode='42501'; end if;
 if exists(select 1 from healthdiet_core.containers where workspace_id=wid and lower(btrim(name))=lower(btrim(p_name))) then raise exception 'El táper ya existe.'; end if;
 insert into healthdiet_core.containers(workspace_id,name) values(wid,btrim(p_name)) returning id into result;
 return result;
end $$;
create function healthdiet_private.settings_remove_container(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=healthdiet_private.verified_user();wid uuid;
begin
 select workspace_id into wid from healthdiet_core.members where user_id=uid and left_at is null;
 if wid is null then raise exception 'Se necesita un espacio activo.' using errcode='42501'; end if;
 perform 1 from healthdiet_core.workspaces where id=wid for update;
 if not exists(select 1 from healthdiet_core.members where user_id=uid and workspace_id=wid and left_at is null) then raise exception 'Ya no perteneces al espacio.' using errcode='42501'; end if;
 delete from healthdiet_core.containers where id=p_id and workspace_id=wid;
 if not found then raise exception 'Táper no disponible.' using errcode='42501'; end if;
end $$;
create function healthdiet_private.settings_set_color(p_color text) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=healthdiet_private.verified_user();wid uuid;
begin
 select workspace_id into wid from healthdiet_core.members where user_id=uid and left_at is null;
 if wid is null then raise exception 'Se necesita un espacio activo.' using errcode='42501'; end if;
 if p_color is null or p_color !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Color no válido.'; end if;
 perform 1 from healthdiet_core.workspaces where id=wid for update;
 update healthdiet_core.members set color=lower(p_color) where user_id=uid and workspace_id=wid and left_at is null;
 if not found then raise exception 'Ya no perteneces al espacio.' using errcode='42501'; end if;
end $$;
create function public.hd_settings_read() returns jsonb language sql security invoker set search_path='' as $$select healthdiet_private.settings_read()$$;
create function public.hd_add_container(p_name text) returns uuid language sql security invoker set search_path='' as $$select healthdiet_private.settings_add_container(p_name)$$;
create function public.hd_remove_container(p_id uuid) returns void language sql security invoker set search_path='' as $$select healthdiet_private.settings_remove_container(p_id)$$;
create function public.hd_set_my_color(p_color text) returns void language sql security invoker set search_path='' as $$select healthdiet_private.settings_set_color(p_color)$$;
revoke all on function healthdiet_private.settings_read(),healthdiet_private.settings_add_container(text),healthdiet_private.settings_remove_container(uuid),healthdiet_private.settings_set_color(text) from public,anon,authenticated;
grant execute on function healthdiet_private.settings_read(),healthdiet_private.settings_add_container(text),healthdiet_private.settings_remove_container(uuid),healthdiet_private.settings_set_color(text) to authenticated;
revoke all on function public.hd_settings_read(),public.hd_add_container(text),public.hd_remove_container(uuid),public.hd_set_my_color(text) from public,anon,authenticated;
grant execute on function public.hd_settings_read(),public.hd_add_container(text),public.hd_remove_container(uuid),public.hd_set_my_color(text) to authenticated;