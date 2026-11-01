-- Add a gallery and give a login access to it.
-- 1. In Supabase, go to Authentication > Users > Add user, and create the gallery's login
--    (email and password, tick "Auto Confirm User").
-- 2. Change the four values in quotes below, then run this file in the SQL Editor.

insert into public.galleries (slug, name, city)
values ('dhoomimal', 'Dhoomimal Art Centre', 'New Delhi')
on conflict (slug) do nothing;

insert into public.members (user_id, gallery)
select id, 'dhoomimal' from auth.users where email = 'admin@example.com'
on conflict do nothing;
