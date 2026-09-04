-- Seed UEFA Champions League 2026/27 in public.competitions.
-- Run once before import-competition-players.mjs (requires competition-isolation migration).

insert into public.competitions (id, slug, name, status, archived_at)
values (4, 'uefa-cl-2026-27', 'UEFA Champions League 2026/27', 'active', null)
on conflict (slug) do update
set name = excluded.name,
    status = excluded.status,
    archived_at = excluded.archived_at;

select id, slug, name, status from public.competitions where slug = 'uefa-cl-2026-27';
