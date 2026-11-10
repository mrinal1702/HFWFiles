-- Default table grants: service_role only (Oct 2026). Apply by hand in the Supabase SQL Editor.
--
-- Why: Supabase stops auto-granting Data API access to new public tables on 2026-10-30. Until then,
-- tables created by postgres in public are auto-granted to anon + authenticated + service_role.
-- The app and ops scripts use the service-role key (see security-lockdown.sql), so new tables only
-- need service_role. This makes that the default now, so nothing changes on 2026-10-30.
--
-- Only affects tables created AFTER this runs. Existing tables keep their current grants.
-- A new table the browser must read (like profiles) still needs an explicit grant to anon/authenticated.
--
-- Undo:
--   alter default privileges for role postgres in schema public
--     grant all on tables to anon, authenticated;

begin;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  grant all on tables to service_role;

commit;

-- Check: the postgres row should list only postgres and service_role.
select pg_get_userbyid(defaclrole) as owner, defaclacl
from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace
where n.nspname = 'public' and defaclobjtype = 'r';
