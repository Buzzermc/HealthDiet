-- Actualizar o eliminar un menú solo dentro del espacio de una persona activa.
-- La edición mantiene el identificador y el estado activo.
create function healthdiet_private.update_menu(p_menu_id uuid,p_name text,p_days jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=healthdiet_private.verified_user(); wid uuid; temp_id uuid;
begin
 select workspace_id into wid from healthdiet_core.members where user_id=uid and left_at is null;
 if wid is null then raise exception 'Se necesita un espacio activo.' using errcode='42501';end if;
 perform 1 from healthdiet_core.workspaces where id=wid for update;
 if not exists(select 1 from healthdiet_core.members where workspace_id=wid and user_id=uid and left_at is null)
 then raise exception 'Ya no perteneces al espacio.' using errcode='42501';end if;
 if not exists(select 1 from healthdiet_core.menus where workspace_id=wid and id=p_menu_id)
 then raise exception 'Menú no disponible.' using errcode='42501';end if;
 -- Reutiliza la validación de comida/cena y propiedad de cada receta.
 temp_id:=healthdiet_private.save_menu(p_name,p_days);
 delete from healthdiet_core.menu_recipes where workspace_id=wid and menu_id=p_menu_id;
 update healthdiet_core.menu_recipes set menu_id=p_menu_id where workspace_id=wid and menu_id=temp_id;
 update healthdiet_core.menus set name=btrim(p_name) where workspace_id=wid and id=p_menu_id;
 delete from healthdiet_core.menus where workspace_id=wid and id=temp_id;
end $$;

create function healthdiet_private.delete_menu(p_menu_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=healthdiet_private.verified_user();wid uuid;
begin
 select workspace_id into wid from healthdiet_core.members where user_id=uid and left_at is null;
 if wid is null then raise exception 'Se necesita un espacio activo.' using errcode='42501';end if;
 perform 1 from healthdiet_core.workspaces where id=wid for update;
 if not exists(select 1 from healthdiet_core.members where workspace_id=wid and user_id=uid and left_at is null)
 then raise exception 'Ya no perteneces al espacio.' using errcode='42501';end if;
 delete from healthdiet_core.menus where workspace_id=wid and id=p_menu_id;
 if not found then raise exception 'Menú no disponible.' using errcode='42501';end if;
end $$;

create function public.hd_update_menu(p_menu_id uuid,p_name text,p_days jsonb) returns void
language sql security invoker set search_path='' as $$select healthdiet_private.update_menu(p_menu_id,p_name,p_days)$$;
create function public.hd_delete_menu(p_menu_id uuid) returns void
language sql security invoker set search_path='' as $$select healthdiet_private.delete_menu(p_menu_id)$$;
revoke all on function healthdiet_private.update_menu(uuid,text,jsonb),healthdiet_private.delete_menu(uuid) from public,anon,authenticated;
grant execute on function healthdiet_private.update_menu(uuid,text,jsonb),healthdiet_private.delete_menu(uuid) to authenticated;
revoke all on function public.hd_update_menu(uuid,text,jsonb),public.hd_delete_menu(uuid) from public,anon,authenticated;
grant execute on function public.hd_update_menu(uuid,text,jsonb),public.hd_delete_menu(uuid) to authenticated;