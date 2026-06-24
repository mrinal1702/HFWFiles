-- Formation slot for Best XI display (GK / D / M / F). Set by publish-best-xi-from-json.mjs.
-- null on bench rows or before Best XI is published.

alter table public.gameweek_squads
  add column if not exists xi_role text;

comment on column public.gameweek_squads.xi_role is
  'Best XI formation slot: GK, D, M, or F. Null on bench. Set when commissioner publishes Best XI.';
