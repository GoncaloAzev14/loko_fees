-- An invited person is not an admin until they finish their first access (sign in with the
-- password, or choose one). Until then the invitation is pending: it shows on the admin list
-- with a resend button, and gives no rights.
--
-- admins.accepted_at: when the person accepted. Null = invitation still pending.
-- Rows added by hand (the first admin, step 3 of the README) are accepted straight away.

alter table public.admins add column accepted_at timestamptz default now();

-- People invited from the app before this change had access without ever finishing: pending again.
update public.admins a set accepted_at = null
from auth.users u where u.id = a.user_id and u.invited_at is not null;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and accepted_at is not null);
$$;

-- Invitations are created pending; the helper the Edge Function uses.
create or replace function public.add_admin_by_email(p_email text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    return false;
  end if;
  insert into public.admins (user_id, accepted_at) values (uid, null) on conflict do nothing;
  return true;
end $$;

-- The signed-in person accepts their own pending invitation. Called by the app right after a
-- password sign-in or after choosing a password. Does nothing for anyone who was not invited.
create function public.accept_admin_invite() returns void
language sql security definer set search_path = public as $$
  update public.admins set accepted_at = now() where user_id = auth.uid() and accepted_at is null;
$$;

create or replace function public.list_admins() returns table (user_id uuid, email text, pending boolean)
language sql stable security definer set search_path = public as $$
  select a.user_id, u.email::text, a.accepted_at is null
  from public.admins a join auth.users u on u.id = a.user_id
  where public.is_admin()
  order by u.email;
$$;

-- 'none' = no admin entry for that email, 'pending' = invited and not accepted yet, 'admin' = accepted.
create or replace function public.invite_state(p_email text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when a.accepted_at is null then 'pending' else 'admin' end
     from auth.users u join public.admins a on a.user_id = u.id
     where lower(u.email) = lower(trim(p_email))),
    'none');
$$;

revoke all on function public.accept_admin_invite() from public, anon;
grant execute on function public.accept_admin_invite() to authenticated;
