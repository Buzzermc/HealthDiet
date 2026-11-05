create or replace function healthdiet_private.settings_set_name(p_name text)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=healthdiet_private.verified_user(); wid uuid; clean_name text:=btrim(p_name);
begin
 if clean_name is null or length(clean_name) not between 1 and 120 then
  raise exception 'El nombre debe tener entre 1 y 120 caracteres.';
 end if;
 select workspace_id into wid from healthdiet_core.members where user_id=uid and left_at is null;
 if wid is null then raise exception 'Se necesita un espacio activo.' using errcode='42501'; end if;
 perform 1 from healthdiet_core.workspaces where id=wid for update;
 update healthdiet_core.members set display_name=clean_name
 where user_id=uid and workspace_id=wid and left_at is null;
 if not found then raise exception 'Ya no perteneces al espacio.' using errcode='42501';end if;
end $$;
create or replace function public.hd_set_my_name(p_name text)
returns void language sql set search_path='' as $$select healthdiet_private.settings_set_name(p_name)$$;
revoke all on function healthdiet_private.settings_set_name(text),public.hd_set_my_name(text) from public,anon;
grant execute on function healthdiet_private.settings_set_name(text),public.hd_set_my_name(text) to authenticated;
