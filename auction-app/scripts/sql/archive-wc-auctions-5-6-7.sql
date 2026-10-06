-- Mark World Cup 2026 online auctions as inactive after the tournament.
-- Historical. The UI now derives Archives from competitions.status (see archive-competition.sql).
-- Setting is_active = false closes bidding if anything is still open.

update public."Auctions"
set is_active = false
where id in (5, 6, 7);

select id, name, is_active
from public."Auctions"
where id in (5, 6, 7)
order by id;
