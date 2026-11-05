-- Funciones transaccionales para espacios. No envían correos.
-- Toda función privilegiada verifica identidad contra auth.users y usa un search_path fijo.
create schema if not exists healthdiet_private;
revoke all on schema healthdiet_private from public, anon, authenticated;
grant usage on schema healthdiet_private to authenticated;

create function healthdiet_private.verified_user()
returns uuid language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (
    select 1 from auth.users u
    where u.id = uid and u.email_confirmed_at is not null
      and coalesce(u.is_anonymous, false) = false
  ) then raise exception 'Se requiere una cuenta con correo verificado.' using errcode = '42501'; end if;
  return uid;
end $$;

create function healthdiet_private.create_workspace(p_workspace_name text, p_display_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare uid uuid := healthdiet_private.verified_user(); wid uuid;
begin
  if length(btrim(coalesce(p_workspace_name,''))) not between 1 and 120
     or length(btrim(coalesce(p_display_name,''))) not between 1 and 120 then
    raise exception 'Indica el nombre del espacio y tu nombre.';
  end if;
  insert into healthdiet_core.workspaces(name) values (btrim(p_workspace_name)) returning id into wid;
  insert into healthdiet_core.members(workspace_id,user_id,display_name,role)
    values (wid,uid,btrim(p_display_name),'admin');
  insert into healthdiet_core.containers(workspace_id,name) values (wid,'pequeño'),(wid,'grande');
  return wid;
end $$;

create function healthdiet_private.my_workspace()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := healthdiet_private.verified_user(); result jsonb;
begin
  select jsonb_build_object('id',w.id,'name',w.name,'my_member_id',m.id,'role',m.role,
    'members',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'color',p.color,'role',p.role) order by p.joined_at,p.id),'[]'::jsonb)
      from healthdiet_core.members p where p.workspace_id=w.id and p.left_at is null))
    into result from healthdiet_core.members m join healthdiet_core.workspaces w on w.id=m.workspace_id
    where m.user_id=uid and m.left_at is null;
  return result;
end $$;

create function healthdiet_private.invite(p_email text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare uid uuid := healthdiet_private.verified_user(); m healthdiet_core.members%rowtype; iid uuid; target_email text := lower(btrim(p_email));
begin
  if target_email is null or length(target_email) not between 3 and 320 or target_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Indica un correo válido.';
  end if;
  select * into m from healthdiet_core.members where user_id=uid and left_at is null;
  if not found or m.role <> 'admin' then raise exception 'Solo el administrador puede invitar.' using errcode='42501'; end if;
  perform 1 from healthdiet_core.workspaces where id=m.workspace_id for update;
  if not exists (select 1 from healthdiet_core.members where id=m.id and left_at is null and role='admin') then
    raise exception 'Ya no eres administrador.' using errcode='42501';
  end if;
  if exists (select 1 from healthdiet_core.members a join auth.users u on u.id=a.user_id
      where a.workspace_id=m.workspace_id and a.left_at is null and lower(u.email)=target_email) then
    raise exception 'Esta persona ya pertenece al espacio.';
  end if;
  update healthdiet_core.invitations set revoked_at=now()
    where workspace_id=m.workspace_id and lower(invited_email)=target_email and accepted_at is null and revoked_at is null;
  insert into healthdiet_core.invitations(workspace_id,invited_email,invited_by,expires_at)
    values(m.workspace_id,target_email,m.id,now()+interval '7 days') returning id into iid;
  return iid;
end $$;

create function healthdiet_private.my_invitations()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := healthdiet_private.verified_user(); result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'workspace_name',w.name,'expires_at',i.expires_at)
    order by i.created_at desc),'[]'::jsonb)
  into result from healthdiet_core.invitations i
    join healthdiet_core.workspaces w on w.id=i.workspace_id
    join auth.users u on u.id=uid
    where lower(i.invited_email)=lower(u.email) and i.accepted_at is null and i.revoked_at is null and i.expires_at > now();
  return result;
end $$;

create function healthdiet_private.accept_invitation(p_invitation uuid,p_display_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare uid uuid := healthdiet_private.verified_user(); inv healthdiet_core.invitations%rowtype; target_email text;
begin
  if length(btrim(coalesce(p_display_name,''))) not between 1 and 120 then raise exception 'Indica tu nombre.'; end if;
  select lower(u.email) into target_email from auth.users u where u.id=uid;
  select * into inv from healthdiet_core.invitations where id=p_invitation for update;
  if not found or lower(inv.invited_email)<>target_email or inv.accepted_at is not null or inv.revoked_at is not null or inv.expires_at<=now() then
    raise exception 'La invitación no está disponible.' using errcode='42501';
  end if;
  perform 1 from healthdiet_core.workspaces where id=inv.workspace_id for update;
  if not exists (select 1 from healthdiet_core.members where id=inv.invited_by and left_at is null and role='admin') then
    raise exception 'La invitación ya no está disponible.' using errcode='42501';
  end if;
  insert into healthdiet_core.members(workspace_id,user_id,display_name,role)
    values (inv.workspace_id,uid,btrim(p_display_name),'member');
  update healthdiet_core.invitations set accepted_at=now() where id=inv.id;
  return inv.workspace_id;
end $$;

create function healthdiet_private.transfer_admin(p_member_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare uid uuid := healthdiet_private.verified_user(); m healthdiet_core.members%rowtype;
begin
  select * into m from healthdiet_core.members where user_id=uid and left_at is null;
  if not found or m.role<>'admin' then raise exception 'Solo el administrador puede traspasar el espacio.' using errcode='42501'; end if;
  perform 1 from healthdiet_core.workspaces where id=m.workspace_id for update;
  if not exists (select 1 from healthdiet_core.members where id=m.id and left_at is null and role='admin') then raise exception 'Ya no eres administrador.' using errcode='42501'; end if;
  if p_member_id=m.id or not exists (select 1 from healthdiet_core.members where id=p_member_id and workspace_id=m.workspace_id and left_at is null) then
    raise exception 'Selecciona otro miembro activo del espacio.';
  end if;
  update healthdiet_core.members set role='admin' where id=p_member_id;
  update healthdiet_core.members set role='member' where id=m.id;
end $$;

create function healthdiet_private.leave_workspace()
returns void language plpgsql security definer set search_path = ''
as $$
declare uid uuid := healthdiet_private.verified_user(); m healthdiet_core.members%rowtype;
begin
  select * into m from healthdiet_core.members where user_id=uid and left_at is null;
  if not found then raise exception 'No perteneces a un espacio.'; end if;
  perform 1 from healthdiet_core.workspaces where id=m.workspace_id for update;
  select * into m from healthdiet_core.members where id=m.id and left_at is null;
  if not found then raise exception 'Ya no perteneces a un espacio.'; end if;
  if m.role='admin' and not exists (select 1 from healthdiet_core.members where workspace_id=m.workspace_id and role='admin' and left_at is null and id<>m.id) then
    raise exception 'Transfiere primero la administración a otro miembro.';
  end if;
  update healthdiet_core.members set left_at=now() where id=m.id;
end $$;

-- SECURITY INVOKER: la función pública solo delega en operaciones privadas verificadas.
create function public.hd_create_workspace(p_workspace_name text,p_display_name text) returns uuid
language sql security invoker set search_path = '' as $$select healthdiet_private.create_workspace(p_workspace_name,p_display_name)$$;
create function public.hd_my_workspace() returns jsonb
language sql security invoker set search_path = '' as $$select healthdiet_private.my_workspace()$$;
create function public.hd_invite(p_email text) returns uuid
language sql security invoker set search_path = '' as $$select healthdiet_private.invite(p_email)$$;
create function public.hd_my_invitations() returns jsonb
language sql security invoker set search_path = '' as $$select healthdiet_private.my_invitations()$$;
create function public.hd_accept_invitation(p_invitation uuid,p_display_name text) returns uuid
language sql security invoker set search_path = '' as $$select healthdiet_private.accept_invitation(p_invitation,p_display_name)$$;
create function public.hd_transfer_admin(p_member_id uuid) returns void
language sql security invoker set search_path = '' as $$select healthdiet_private.transfer_admin(p_member_id)$$;
create function public.hd_leave_workspace() returns void
language sql security invoker set search_path = '' as $$select healthdiet_private.leave_workspace()$$;

revoke all on all functions in schema healthdiet_private from public, anon, authenticated;
grant execute on function healthdiet_private.create_workspace(text,text),healthdiet_private.my_workspace(),
 healthdiet_private.invite(text),healthdiet_private.my_invitations(),
 healthdiet_private.accept_invitation(uuid,text),healthdiet_private.transfer_admin(uuid),
 healthdiet_private.leave_workspace() to authenticated;
revoke all on function public.hd_create_workspace(text,text),public.hd_my_workspace(),public.hd_invite(text),
 public.hd_my_invitations(),public.hd_accept_invitation(uuid,text),public.hd_transfer_admin(uuid),
 public.hd_leave_workspace() from public, anon, authenticated;
grant execute on function public.hd_create_workspace(text,text),public.hd_my_workspace(),public.hd_invite(text),
 public.hd_my_invitations(),public.hd_accept_invitation(uuid,text),public.hd_transfer_admin(uuid),
 public.hd_leave_workspace() to authenticated;
