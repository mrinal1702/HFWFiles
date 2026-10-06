-- Archive a finished competition (and therefore every auction attached to it).
--
-- The participant UI derives "archived" from competitions.status (lib/archived-auctions.ts):
-- an auction moves from Active Auctions to Archives as soon as its competition is archived.
-- No data is deleted — standings, squads, scores and Auction History keep working.
-- Commissioner write scripts (lock / upsert / publish Best XI) refuse archived competitions
-- unless run with --allow-archived (scripts/lib/archived-competition-guard.mjs).
--
-- Does NOT touch "Game_Weeks".Is_Active (global flag shared with active competitions).
--
-- Applied Oct 2026 for EPL 2026/27 (competition 2, auction 9). World Cup 2026
-- (competition 1, auctions 5/6/7) was already archived; its auctions are closed here too.

update public.competitions
set status = 'archived',
    archived_at = coalesce(archived_at, now())
where id in (2);

update public."Auctions"
set is_active = false
where competition_id in (
  select id from public.competitions where status = 'archived'
)
and id in (5, 6, 7, 9);

select c.id as competition_id, c.slug, c.status, c.archived_at, a.id as auction_id, a.name, a.is_active
from public.competitions c
left join public."Auctions" a on a.competition_id = c.id
order by c.id, a.id;
