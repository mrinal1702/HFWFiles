-- Fix trial auction 8 join code (TRIALR168 was 9 chars; app accepts 6–8 only).
-- Run once in Supabase SQL Editor.

update public."Auctions"
set join_code = 'TRIALR16'
where id = 8;

-- verify
select id, name, join_code, length(join_code) as code_len
from public."Auctions"
where id = 8;
