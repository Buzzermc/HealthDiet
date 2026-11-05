create or replace function healthdiet_private.shopping_delete_menu(p_menu_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare wid uuid:=healthdiet_private.shopping_workspace(); was_active boolean;
begin
 select active into was_active from healthdiet_core.menus where workspace_id=wid and id=p_menu_id;
 perform healthdiet_private.delete_menu(p_menu_id);
 if was_active then delete from healthdiet_core.shopping_checks where workspace_id=wid; end if;
end $$;
revoke all on function healthdiet_private.shopping_delete_menu(uuid) from public,anon;
grant execute on function healthdiet_private.shopping_delete_menu(uuid) to authenticated;
create or replace function public.hd_delete_menu(p_menu_id uuid) returns void language sql set search_path='' as $$select healthdiet_private.shopping_delete_menu(p_menu_id)$$;
create or replace function public.hd_activate_menu(p_menu_id uuid) returns void language sql set search_path='' as $$select healthdiet_private.shopping_activate(p_menu_id,false)$$;
create or replace function public.hd_update_menu(p_menu_id uuid,p_name text,p_days jsonb) returns void language sql set search_path='' as $$select healthdiet_private.shopping_update_menu(p_menu_id,p_name,p_days,false)$$;
create or replace function public.hd_update_recipe(p_recipe_id uuid,p_name text,p_container text,p_steps jsonb,p_dishes jsonb) returns void language sql set search_path='' as $$select healthdiet_private.shopping_update_recipe(p_recipe_id,p_name,p_container,p_steps,p_dishes,false)$$;
