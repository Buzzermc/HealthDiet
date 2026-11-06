create function healthdiet_private.rename_workspace(p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := healthdiet_private.verified_user(); member_row healthdiet_core.members%rowtype; clean_name text := btrim(p_name);
begin
 if clean_name is null or length(clean_name) not between 1 and 120 then raise exception 'El nombre debe tener entre 1 y 120 caracteres.'; end if;
 select * into member_row from healthdiet_core.members where user_id=uid and left_at is null;
 if not found or member_row.role <> 'admin' then raise exception 'Solo el administrador puede cambiar el nombre del espacio.' using errcode='42501'; end if;
 perform 1 from healthdiet_core.workspaces where id=member_row.workspace_id for update;
 if not exists (select 1 from healthdiet_core.members where id=member_row.id and user_id=uid and workspace_id=member_row.workspace_id and left_at is null and role='admin') then raise exception 'Ya no eres administrador.' using errcode='42501'; end if;
 update healthdiet_core.workspaces set name=clean_name where id=member_row.workspace_id;
end $$;
revoke all on function healthdiet_private.rename_workspace(text) from public, anon, authenticated;
grant execute on function healthdiet_private.rename_workspace(text) to authenticated;
create function public.hd_rename_workspace(p_name text) returns void language sql security invoker set search_path = '' as $$ select healthdiet_private.rename_workspace(p_name) $$;
revoke all on function public.hd_rename_workspace(text) from public, anon, authenticated;
grant execute on function public.hd_rename_workspace(text) to authenticated, service_role;
