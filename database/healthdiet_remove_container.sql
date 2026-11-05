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
create function public.hd_remove_container(p_id uuid) returns void language sql security invoker set search_path='' as $$select healthdiet_private.settings_remove_container(p_id)$$;
revoke all on function healthdiet_private.settings_remove_container(uuid) from public,anon,authenticated;
grant execute on function healthdiet_private.settings_remove_container(uuid) to authenticated;
revoke all on function public.hd_remove_container(uuid) from public,anon,authenticated;
grant execute on function public.hd_remove_container(uuid) to authenticated;