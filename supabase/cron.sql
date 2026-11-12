-- Optional: apply late fees automatically every day at 06:00 UTC.
-- Requires the pg_cron extension (Supabase dashboard -> Database -> Extensions).
-- Run once in the SQL editor. Without it, late fees are still applied whenever an
-- admin opens the app.
select cron.schedule('apply-late-fees', '0 6 * * *', $$select public.apply_late_fees()$$);
